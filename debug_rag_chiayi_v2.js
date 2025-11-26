
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 初始化 Supabase 客戶端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 初始化 Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function createEmbedding(text) {
  try {
    // 嘗試使用 text-embedding-004
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent({
      content: { parts: [{ text }] },
      outputDimensionality: 768
    });
    return result.embedding.values;
  } catch (error) {
    console.error('生成向量失敗:', error.message);
    throw error;
  }
}

async function testQuery(queryText) {
    console.log(`\n🔍 測試查詢: "${queryText}"`);
    
    const queryEmbedding = await createEmbedding(queryText);
    
    // 增加 limit 到 100 以便更有機會找到
    const { data, error } = await supabase.rpc('match_attractions', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1, // 極低閾值
      match_count: 100,
      filter_city: null,
      filter_category: null
    });

    if (error) {
        console.error("❌ RPC 錯誤:", error);
        return;
    }

    // 找找看有沒有 "嘉義市立博物館"
    const target = data.find(item => item.name.includes("嘉義市立博物館"));
    if (target) {
        console.log(`✅ 找到 "嘉義市立博物館"! Similarity: ${target.similarity.toFixed(4)}`);
        console.log(`   Rank: ${data.indexOf(target) + 1}`);
    } else {
        console.log(`❌ 未在前 100 筆結果中找到 "嘉義市立博物館"`);
    }

    // 顯示前 3 名
    console.log("   Top 3 Results:");
    data.slice(0, 3).forEach((item, i) => {
        console.log(`   ${i+1}. ${item.name} (${item.city}) - Sim: ${item.similarity.toFixed(4)}`);
    });
}

async function runDebug() {
    await testQuery("嘉義市的博物館");
    await testQuery("博物館");
    await testQuery("嘉義市立博物館");
}

runDebug();
