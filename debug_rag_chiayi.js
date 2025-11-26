
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
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
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

async function runDebug() {
    const queryText = "嘉義市的博物館";
    const filters = { city: "嘉義市" };
    const limit = 10;
    const threshold = 0.25;

    console.log(`🔍 測試查詢: "${queryText}"`);
    console.log(`📍 篩選條件:`, filters);

    // 1. 生成向量
    const queryEmbedding = await createEmbedding(queryText);
    console.log("✅ 向量生成成功");

    // 2. 執行 RPC (不帶 filter_city)
    const rpcLimit = limit * 5; 
    const rpcThreshold = threshold * 0.9;

    console.log(`📡 呼叫 RPC match_attractions (limit=${rpcLimit}, threshold=${rpcThreshold})...`);
    
    const { data, error } = await supabase.rpc('match_attractions', {
      query_embedding: queryEmbedding,
      match_threshold: rpcThreshold,
      match_count: rpcLimit,
      filter_city: null,
      filter_category: null
    });

    if (error) {
        console.error("❌ RPC 錯誤:", error);
        return;
    }

    console.log(`📥 RPC 返回 ${data.length} 筆結果`);

    // 3. 顯示前 5 筆原始結果 (檢查 City 和 Address)
    console.log("\n--- 前 5 筆原始結果 ---");
    data.slice(0, 5).forEach((item, i) => {
        console.log(`${i+1}. ${item.name} | City: ${item.city} | Dist: ${item.district} | Addr: ${item.address} | Sim: ${item.similarity.toFixed(4)}`);
    });

    // 4. 執行第一層過濾 (通用城市過濾)
    let results = data || [];
    if (filters.city) {
        const normalizeCity = (str) => str ? str.trim().toLowerCase().replace(/臺/g, '台') : '';
        const targetCity = normalizeCity(filters.city);
        
        results = results.filter(item => {
            const city = normalizeCity(item.city);
            const address = normalizeCity(item.address || '');
            const district = normalizeCity(item.district || '');
            
            const match = city === targetCity || city.startsWith(targetCity) || address.includes(targetCity) || district.includes(targetCity);
            if (!match && item.name.includes("博物館")) {
                 console.log(`⚠️ [通用過濾剔除] ${item.name} (City: ${city}, Addr: ${address})`);
            }
            return match;
        });
        console.log(`\n🧹 通用過濾後剩餘: ${results.length} 筆`);
    }

    // 5. 執行第二層過濾 (嘉義市專用)
    const isChiayiCityQuery = filters.city === '嘉義市';
    if (isChiayiCityQuery && results.length > 0) {
        console.log("\n🕵️ 執行嘉義市精細過濾...");
        results = results.filter(item => {
            const city = item.city ? item.city.trim() : '';
            const address = item.address || '';
            const district = item.district ? item.district.trim() : '';
            
            // 1. 絕對排除
            if (city === '嘉義縣' || address.includes('嘉義縣')) {
                console.log(`❌ [嘉義排除] ${item.name} (是嘉義縣)`);
                return false;
            }

            // 2. 必須包含
            if (city === '嘉義市' || address.includes('嘉義市')) {
                return true;
            }

            // 3. 寬鬆匹配
            if (city.includes('嘉義') && (district === '東區' || district === '西區')) {
                return true;
            }
            
            console.log(`❌ [嘉義排除] ${item.name} (不符合嘉義市條件: City=${city}, Dist=${district}, Addr=${address})`);
            return false;
        });
        console.log(`🏁 最終剩餘: ${results.length} 筆`);
    }

    console.log("\n--- 最終結果列表 ---");
    results.forEach((item, i) => {
        console.log(`${i+1}. ${item.name}`);
    });
}

runDebug();
