
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import csv from 'csv-parser';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function fixMuseum() {
    console.log("🔧 開始修復 '嘉義市立博物館'...");

    // 1. 刪除舊資料
    const { error: delError } = await supabase
        .from('tourist_attractions')
        .delete()
        .eq('name', '嘉義市立博物館');
    
    if (delError) {
        console.error("❌ 刪除失敗:", delError);
        return;
    }
    console.log("✅ 舊資料已刪除");

    // 2. 從 CSV 讀取資料
    const rows = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream('./data/all_spot.csv')
            .pipe(csv())
            .on('data', (row) => {
                if (row.Name === '嘉義市立博物館') {
                    rows.push(row);
                }
            })
            .on('end', resolve)
            .on('error', reject);
    });

    if (rows.length === 0) {
        console.error("❌ CSV 中找不到 '嘉義市立博物館'");
        return;
    }

    const row = rows[0];
    console.log("✅ 讀取到 CSV 資料:", row.Name);

    // 3. 生成新向量
    const textForEmbedding = [
      '嘉義市',
      row.Town,
      row.Name,
      row.Description || row.Toldescribe,
      row.Add,
      row.Keyword,
      '景點', '觀光'
    ].filter(Boolean).join(' ');

    console.log("📝 用於向量化的文本:", textForEmbedding.substring(0, 100) + "...");

    const embedding = await createEmbedding(textForEmbedding);
    console.log("✅ 新向量生成成功");

    // 4. 插入新資料
    // 分類判斷
    let category = '博物館展覽'; // 強制指定
    
    const features = ['適合親子', '室內景點', '博物館'];

    const { error: insError } = await supabase
      .from('tourist_attractions')
      .insert({
        name: row.Name,
        category: category,
        city: '嘉義市',
        district: row.Town,
        address: row.Add,
        description: row.Description || row.Toldescribe,
        features: features,
        phone: row.Tel,
        opening_hours: row.Opentime ? { info: row.Opentime } : null,
        website: row.Website,
        embedding: embedding,
        metadata: {
          source: 'all_spot.csv',
          id: row.Id,
          reimported: true
        }
      });

    if (insError) {
        console.error("❌ 插入失敗:", insError);
        return;
    }
    console.log("✅ 新資料插入成功");

    // 5. 立即測試搜尋
    console.log("\n🔍 測試搜尋 '嘉義市的博物館'...");
    const queryEmbedding = await createEmbedding("嘉義市的博物館");
    
    const { data, error } = await supabase.rpc('match_attractions', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: 10,
      filter_city: null,
      filter_category: null
    });

    if (error) {
        console.error("❌ 搜尋錯誤:", error);
        return;
    }

    const target = data.find(item => item.name === '嘉義市立博物館');
    if (target) {
        console.log(`✅ 搜尋成功! 找到 '嘉義市立博物館', Similarity: ${target.similarity.toFixed(4)}`);
    } else {
        console.log("❌ 搜尋失敗，仍未找到");
        console.log("Top 3:", data.slice(0, 3).map(i => i.name).join(', '));
    }
}

fixMuseum();
