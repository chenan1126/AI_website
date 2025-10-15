# RAG 向量資料庫實作指南

## 概述

本指南詳細說明如何使用 Supabase + LangChain 建立 RAG（Retrieval-Augmented Generation）系統，解決 LLM 推薦景點不準確的問題。

---

## 為什麼需要 RAG？

### 現有問題
- ❌ LLM 會推薦不存在的景點（幻覺問題）
- ❌ 推薦已歇業的店家
- ❌ 地點名稱錯誤或模糊
- ❌ 缺乏最新的營業資訊

### RAG 解決方案
- ✅ 從真實資料庫檢索景點資訊
- ✅ 確保所有推薦都是經過驗證的真實地點
- ✅ 支援語意搜尋（例如「適合親子的景點」）
- ✅ 自動過濾已歇業店家

---

## 技術架構

```
用戶查詢
    ↓
[前端] 送出旅遊需求
    ↓
[後端] 將查詢向量化 (OpenAI Embeddings)
    ↓
[Supabase] 向量相似度搜尋 (pgvector)
    ↓
[LangChain] 檢索最相關的景點
    ↓
[Gemini] 基於真實景點資料生成行程
    ↓
[前端] 顯示行程結果
```

---

## 步驟 1: 設置 Supabase

### 1.1 啟用 pgvector 擴展

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇您的專案
3. 前往 **Database** → **Extensions**
4. 搜尋 `vector`
5. 啟用 `pgvector` 擴展

### 1.2 建立資料表

在 **SQL Editor** 中執行：

```sql
-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 建立景點資料表
CREATE TABLE tourist_attractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT, -- 景點類型
  city TEXT NOT NULL, -- 縣市
  district TEXT, -- 區域
  address TEXT,
  description TEXT, -- 景點描述
  features TEXT[], -- 特色標籤
  google_place_id TEXT UNIQUE,
  google_rating NUMERIC,
  google_user_ratings_total INTEGER,
  price_level INTEGER,
  business_status TEXT, -- OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY
  phone TEXT,
  website TEXT,
  opening_hours JSONB,
  photos TEXT[], -- Google Photos references
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small 向量
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立向量搜尋索引
CREATE INDEX ON tourist_attractions 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 建立其他索引
CREATE INDEX idx_attractions_city ON tourist_attractions(city);
CREATE INDEX idx_attractions_category ON tourist_attractions(category);
CREATE INDEX idx_attractions_status ON tourist_attractions(business_status);
```

### 1.3 建立向量搜尋函數

```sql
CREATE OR REPLACE FUNCTION match_attractions(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_city TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  city TEXT,
  district TEXT,
  address TEXT,
  description TEXT,
  features TEXT[],
  google_rating NUMERIC,
  price_level INTEGER,
  business_status TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.category,
    t.city,
    t.district,
    t.address,
    t.description,
    t.features,
    t.google_rating,
    t.price_level,
    t.business_status,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM tourist_attractions t
  WHERE 
    (filter_city IS NULL OR t.city = filter_city)
    AND (filter_category IS NULL OR t.category = filter_category)
    AND t.business_status = 'OPERATIONAL'
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 步驟 2: 資料收集

### 2.1 安裝必要套件

```bash
npm install @supabase/supabase-js openai dotenv
```

### 2.2 建立資料收集腳本

創建 `scripts/collect_attractions.js`：

```javascript
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const CITIES = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '嘉義市', '新竹縣', '苗栗縣', '彰化縣',
  '南投縣', '雲林縣', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '連江縣'
];

// 從 Google Places API 收集景點
async function collectFromGooglePlaces(city) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
    `query=${encodeURIComponent(city + ' 景點 tourist attraction')}&` +
    `language=zh-TW&` +
    `key=${process.env.GOOGLE_MAPS_API_KEY}`
  );
  
  const data = await response.json();
  
  if (data.status !== 'OK') {
    console.error(`Google Places API error for ${city}:`, data.status);
    return [];
  }
  
  return data.results;
}

// 生成向量嵌入
async function createEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  
  return response.data[0].embedding;
}

// 處理單個景點
async function processAttraction(place, city) {
  // 組合文本用於向量化
  const textForEmbedding = [
    place.name,
    place.types?.join(' '),
    place.formatted_address || '',
    // 可以加入更多描述
  ].filter(Boolean).join(' ');
  
  // 生成向量
  const embedding = await createEmbedding(textForEmbedding);
  
  // 寫入資料庫
  const { data, error } = await supabase
    .from('tourist_attractions')
    .upsert({
      name: place.name,
      city: city,
      address: place.formatted_address,
      google_place_id: place.place_id,
      google_rating: place.rating,
      google_user_ratings_total: place.user_ratings_total,
      price_level: place.price_level,
      business_status: place.business_status || 'OPERATIONAL',
      embedding: embedding,
      metadata: {
        types: place.types,
        geometry: place.geometry
      }
    }, {
      onConflict: 'google_place_id'
    });
  
  if (error) {
    console.error(`Error inserting ${place.name}:`, error);
  } else {
    console.log(`✓ Added: ${place.name}`);
  }
}

// 主函數
async function main() {
  console.log('開始收集台灣景點資料...\n');
  
  for (const city of CITIES) {
    console.log(`\n收集 ${city} 的景點...`);
    
    const places = await collectFromGooglePlaces(city);
    console.log(`找到 ${places.length} 個景點`);
    
    for (const place of places) {
      await processAttraction(place, city);
      // 避免 API 速率限制
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('\n資料收集完成！');
}

main().catch(console.error);
```

### 2.3 執行資料收集

```bash
node scripts/collect_attractions.js
```

---

## 步驟 3: 後端整合 LangChain

### 3.1 安裝套件

```bash
npm install langchain @langchain/community @langchain/openai
```

### 3.2 建立 RAG 檢索器

創建 `api/utils/ragRetriever.js`：

```javascript
import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'text-embedding-3-small'
});

const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: 'tourist_attractions',
  queryName: 'match_attractions'
});

/**
 * 檢索相關景點
 * @param {string} query - 用戶查詢
 * @param {string} city - 縣市過濾
 * @param {number} limit - 返回數量
 * @returns {Promise<Array>} 相關景點列表
 */
export async function retrieveRelevantAttractions(query, city, limit = 15) {
  console.log(`[RAG] 檢索景點 - 查詢: "${query}", 城市: ${city}, 數量: ${limit}`);
  
  try {
    const retriever = vectorStore.asRetriever({
      k: limit,
      filter: city ? { city } : undefined
    });
    
    const docs = await retriever.getRelevantDocuments(query);
    
    console.log(`[RAG] 找到 ${docs.length} 個相關景點`);
    
    // 格式化景點資訊
    const attractions = docs.map(doc => {
      const metadata = doc.metadata;
      return {
        name: metadata.name,
        category: metadata.category,
        address: metadata.address,
        description: metadata.description,
        rating: metadata.google_rating,
        priceLevel: metadata.price_level,
        features: metadata.features
      };
    });
    
    return attractions;
  } catch (error) {
    console.error('[RAG] 檢索失敗:', error);
    return [];
  }
}

/**
 * 將景點列表格式化為 Prompt 文本
 */
export function formatAttractionsForPrompt(attractions) {
  if (!attractions || attractions.length === 0) {
    return '（無可用景點資料）';
  }
  
  return attractions.map((attr, index) => {
    const parts = [
      `${index + 1}. ${attr.name}`,
      attr.category ? `[${attr.category}]` : '',
      attr.address ? `地址: ${attr.address}` : '',
      attr.rating ? `評分: ${attr.rating}/5.0` : '',
      attr.description ? `簡介: ${attr.description}` : '',
      attr.features?.length ? `特色: ${attr.features.join(', ')}` : ''
    ];
    
    return parts.filter(Boolean).join(' | ');
  }).join('\n');
}
```

### 3.3 修改 ask.js

```javascript
import { retrieveRelevantAttractions, formatAttractionsForPrompt } from './utils/ragRetriever.js';

async function buildPrompt(question, location, days, dates, weatherData) {
  // 使用 RAG 檢索相關景點
  const relevantAttractions = await retrieveRelevantAttractions(
    `${question} ${location}`,
    location,
    20
  );
  
  const attractionsText = formatAttractionsForPrompt(relevantAttractions);

  let prompt = `你是一位台灣的專業旅遊行程設計師。

用戶需求：${question}
目的地：${location}
天數：${days}天
日期：${dates.join(', ')}

╔════════════════════════════════════════╗
║   可用的真實景點資料（優先使用）      ║
╚════════════════════════════════════════╝
${attractionsText}

`;

  if (weatherData && Object.keys(weatherData).length > 0) {
    prompt += "天氣預報：\n";
    // ... 天氣資訊
  }

  prompt += `
請根據上述資料設計行程，重要規則：

1. **必須優先使用上述「可用的真實景點資料」中的地點**
2. **地點名稱必須與資料庫中的名稱完全一致**
3. 絕對不要虛構或猜測景點名稱
4. 如果景點資料不足，告知用戶而非編造
5. 絕對不要安排「交通時間」、「移動時間」等交通相關項目
6. 絕對不要推薦住宿、飯店、旅館
7. 使用繁體中文
8. 回應必須是純 JSON 格式

JSON 格式：
{
  "title": "行程標題",
  "sections": [
    {
      "time": "09:00-10:30",
      "location": "景點名稱（必須與資料庫完全一致）",
      "details": ["活動詳情"],
      "day": 1
    }
  ]
}`;

  return prompt;
}
```

---

## 步驟 4: 環境變數設定

在 `.env` 中加入：

```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# OpenAI (用於 Embeddings)
OPENAI_API_KEY=your_openai_api_key

# 現有的 API Keys
GEMINI_API_KEY=your_gemini_key
GOOGLE_MAPS_API_KEY=your_maps_key
CWA_API_KEY=your_cwa_key
```

在 Vercel 環境變數中也要設定這些值！

---

## 步驟 5: 測試與優化

### 5.1 測試腳本

創建 `scripts/test_rag.js`：

```javascript
import { retrieveRelevantAttractions } from '../api/utils/ragRetriever.js';

async function test() {
  const queries = [
    { query: '台北適合親子的景點', city: '台北市' },
    { query: '高雄海邊景點', city: '高雄市' },
    { query: '台中網美咖啡廳', city: '台中市' }
  ];
  
  for (const { query, city } of queries) {
    console.log(`\n測試: ${query} (${city})`);
    console.log('='.repeat(50));
    
    const results = await retrieveRelevantAttractions(query, city, 5);
    
    results.forEach((attr, i) => {
      console.log(`${i + 1}. ${attr.name} - ${attr.rating || 'N/A'}/5.0`);
    });
  }
}

test().catch(console.error);
```

### 5.2 優化參數

調整這些參數以獲得最佳結果：

- `match_threshold`: 相似度閾值（0.7-0.85）
- `match_count`: 檢索數量（10-30）
- `embedding model`: 使用 text-embedding-3-small（便宜且快速）

---

## 預期效果

### Before RAG
```
用戶：「台北一日遊」
AI：推薦「台北101咖啡廳」（不存在）、「信義區美食街」（模糊）
```

### After RAG
```
用戶：「台北一日遊」
AI：推薦「台北101觀景台」、「象山步道」、「饒河街夜市」
（全部來自真實資料庫，有評分、地址、營業狀態）
```

---

## 維護建議

1. **定期更新資料**：每月執行資料收集腳本更新景點資訊
2. **監控準確性**：追蹤虛構景點的比例
3. **用戶反饋**：收集用戶對推薦景點的評價
4. **擴充資料源**：整合政府開放資料、旅遊部落格等

---

## 成本估算

### OpenAI Embeddings
- text-embedding-3-small: $0.02 / 1M tokens
- 假設每個景點 200 tokens，2000 個景點 = 400K tokens
- 初始成本：約 $0.008（不到 1 美元）
- 每次查詢成本：< $0.0001

### Supabase
- Free tier: 500MB 資料庫 + 1GB 傳輸
- 2000 個景點 + 向量約 50MB
- **完全免費！**

---

## 下一步

1. ✅ 完成 Supabase 設置
2. ✅ 執行資料收集腳本
3. ✅ 整合 LangChain 到後端
4. ✅ 測試並優化
5. 📊 監控效果並持續改進

有問題隨時討論！🚀
