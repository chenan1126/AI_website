// ================================================
// 將 CSV 資料導入到 Supabase 向量資料庫
// ================================================
// 執行前請先：npm install csv-parser dotenv @google/generative-ai

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import csv from 'csv-parser';
import 'dotenv/config';

// 初始化 Supabase 客戶端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 初始化 Gemini 客戶端
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 統計資訊
let stats = {
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0
};

// 延遲函數（避免 API 速率限制）
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 生成向量嵌入(使用 Gemini Embedding API)
 * @param {string} text - 要向量化的文本
 * @returns {Promise<number[]>} 向量數組(768 維度)
 */
async function createEmbedding(text) {
  try {
    // 清理文本:移除多餘空白、特殊字符、控制字符、非法 Unicode
    const cleanText = text
      .replace(/\s+/g, ' ')           // 多個空白合併為一個
      .replace(/[\u200B-\u200D\uFEFF]/g, '')  // 移除零寬度字符
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')  // 移除控制字符
      .replace(/[^\x20-\x7E\u4E00-\u9FFF\u3000-\u303F]/g, '')  // 只保留 ASCII 可見字符和中文字符
      .trim();
    
    // 檢查是否有有效內容
    if (!cleanText || cleanText.length < 3) {
      throw new Error('文本內容無效或太短');
    }
    
    // 限制長度
    const finalText = cleanText.length > 5000 ? cleanText.substring(0, 5000) : cleanText;
    
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const result = await model.embedContent({
      content: { parts: [{ text: finalText }] },
      taskType: 'RETRIEVAL_DOCUMENT',  // 針對文檔檢索優化
      outputDimensionality: 768         // 設定為 768 維
    });
    return result.embedding.values;
  } catch (error) {
    console.error('生成向量失敗:', error.message);
    throw error;
  }
}

/**
 * 縣市名稱標準化
 */
function normalizeCity(region) {
  if (!region) return null;
  
  // 移除「縣」、「市」後綴以便匹配
  const normalized = region.replace(/[縣市]/g, '');
  
  // 標準化對照表
  const cityMap = {
    '台北': '台北市',
    '臺北': '台北市',
    '新北': '新北市',
    '桃園': '桃園市',
    '台中': '台中市',
    '臺中': '台中市',
    '台南': '台南市',
    '臺南': '台南市',
    '高雄': '高雄市',
    '基隆': '基隆市',
    '新竹': '新竹市',
    '嘉義': '嘉義市',
    '金門': '金門縣',
    '連江': '連江縣',
    '澎湖': '澎湖縣',
    '宜蘭': '宜蘭縣',
    '花蓮': '花蓮縣',
    '台東': '台東縣',
    '臺東': '台東縣',
    '屏東': '屏東縣',
    '雲林': '雲林縣',
    '南投': '南投縣',
    '彰化': '彰化縣',
    '苗栗': '苗栗縣'
  };
  
  return cityMap[normalized] || region;
}

/**
 * 處理餐廳資料
 */
async function processRestaurant(row) {
  try {
    const name = row.Name?.trim();
    const city = normalizeCity(row.Region);
    
    if (!name || !city) {
      console.log(`⚠️  跳過無效資料: ${name || '無名稱'}`);
      stats.skipped++;
      return;
    }
    
    // 組合文本用於向量化（明確加入城市和行政區，增加地理位置權重）
    const textForEmbedding = [
      city,              // 明確加入城市名稱（例如：嘉義市）
      row.Town,          // 明確加入行政區（例如：東區）
      name,
      row.Description,
      row.Add,
      '餐廳', '美食'
    ].filter(Boolean).join(' ');
    
    console.log(`處理餐廳: ${name} (${city}${row.Town || ''})`);
    
    // 生成向量(捕獲錯誤以繼續處理其他記錄)
    let embedding;
    try {
      embedding = await createEmbedding(textForEmbedding);
    } catch (embError) {
      console.error(`⚠️  跳過(向量生成失敗): ${name} - ${embError.message}`);
      stats.skipped++;
      stats.processed++;
      return;
    }
    
    // 提取特色標籤
    const features = [];
    const desc = row.Description || '';
    if (desc.includes('中式') || desc.includes('中菜')) features.push('中式料理');
    if (desc.includes('海鮮')) features.push('海鮮');
    if (desc.includes('小吃')) features.push('小吃');
    if (desc.includes('傳統')) features.push('傳統美食');
    if (desc.includes('特色')) features.push('特色餐廳');
    
    // 插入資料庫
    const { data, error } = await supabase
      .from('tourist_attractions')
      .insert({
        name: name,
        category: '美食餐廳',
        city: city,
        district: row.Town,
        address: row.Add,
        description: row.Description,
        features: features.length > 0 ? features : null,
        phone: row.Tel,
        opening_hours: row.Opentime ? { info: row.Opentime } : null,
        website: row.Website,
        embedding: embedding,
        metadata: {
          source: 'allRestaurant.csv',
          id: row.Id,
          zipcode: row.Zipcode,
          class: row.Class,
          px: row.Px,
          py: row.Py
        }
      });
    
    if (error) {
      console.error(`❌ 插入失敗: ${name}`, error.message);
      stats.failed++;
    } else {
      console.log(`✓ 成功: ${name}`);
      stats.success++;
    }
    
  } catch (error) {
    console.error(`❌ 處理錯誤: ${row.Name}`, error.message);
    stats.failed++;
  }
  
  stats.processed++;
}

/**
 * 處理景點資料
 */
async function processAttraction(row) {
  try {
    const name = row.Name?.trim();
    const city = normalizeCity(row.Region);
    
    if (!name || !city) {
      console.log(`⚠️  跳過無效資料: ${name || '無名稱'}`);
      stats.skipped++;
      return;
    }
    
    // 組合文本用於向量化（明確加入城市和行政區，增加地理位置權重）
    const textForEmbedding = [
      city,              // 明確加入城市名稱（例如：嘉義市）
      row.Town,          // 明確加入行政區（例如：東區）
      name,
      row.Description || row.Toldescribe,
      row.Add,
      row.Keyword,
      '景點', '觀光'
    ].filter(Boolean).join(' ');
    
    console.log(`處理景點: ${name} (${city}${row.Town || ''})`);
    
    // 生成向量(捕獲錯誤以繼續處理其他記錄)
    let embedding;
    try {
      embedding = await createEmbedding(textForEmbedding);
    } catch (embError) {
      console.error(`⚠️  跳過(向量生成失敗): ${name} - ${embError.message}`);
      stats.skipped++;
      stats.processed++;
      return;
    }
    
    // 分類判斷
    let category = '觀光景點';
    const desc = (row.Description || row.Toldescribe || '').toLowerCase();
    const keyword = (row.Keyword || '').toLowerCase();
    
    if (desc.includes('古蹟') || desc.includes('歷史') || keyword.includes('古蹟')) {
      category = '文化古蹟';
    } else if (desc.includes('自然') || desc.includes('山') || desc.includes('海') || keyword.includes('自然')) {
      category = '自然景觀';
    } else if (desc.includes('博物館') || desc.includes('展覽') || keyword.includes('博物館')) {
      category = '博物館展覽';
    } else if (desc.includes('觀光工廠') || keyword.includes('觀光工廠')) {
      category = '觀光工廠';
    }
    
    // 提取特色標籤
    const features = [];
    if (desc.includes('親子') || desc.includes('兒童')) features.push('適合親子');
    if (desc.includes('拍照') || desc.includes('網美')) features.push('適合拍照');
    if (desc.includes('免費')) features.push('免費景點');
    if (row.Keyword) {
      const keywords = row.Keyword.split(/[,，、]/);
      keywords.slice(0, 5).forEach(kw => {
        if (kw.trim()) features.push(kw.trim());
      });
    }
    
    // 插入資料庫
    const { data, error } = await supabase
      .from('tourist_attractions')
      .insert({
        name: name,
        category: category,
        city: city,
        district: row.Town,
        address: row.Add,
        description: row.Description || row.Toldescribe,
        features: features.length > 0 ? [...new Set(features)] : null,
        phone: row.Tel,
        opening_hours: row.Opentime ? { info: row.Opentime } : null,
        website: row.Website,
        embedding: embedding,
        metadata: {
          source: 'all_spot.csv',
          id: row.Id,
          zipcode: row.Zipcode,
          zone: row.Zone,
          class: row.Class1,
          px: row.Px,
          py: row.Py,
          ticket: row.Ticketinfo,
          parking: row.Parkinginfo
        }
      });
    
    if (error) {
      console.error(`❌ 插入失敗: ${name}`, error.message);
      stats.failed++;
    } else {
      console.log(`✓ 成功: ${name}`);
      stats.success++;
    }
    
  } catch (error) {
    console.error(`❌ 處理錯誤: ${row.Name}`, error.message);
    stats.failed++;
  }
  
  stats.processed++;
}

/**
 * 主函數
 */
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   開始導入資料到 Supabase 向量資料庫   ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  // 檢查環境變數
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ 請在 .env 中設定 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ 請在 .env 中設定 GEMINI_API_KEY');
    process.exit(1);
  }
  
  // 選擇要導入的檔案
  const choice = process.argv[2];
  
  if (!choice || !['restaurants', 'attractions', 'all'].includes(choice)) {
    console.log('使用方式:');
    console.log('  node import_data_to_supabase.js restaurants  # 只導入餐廳');
    console.log('  node import_data_to_supabase.js attractions  # 只導入景點');
    console.log('  node import_data_to_supabase.js all          # 導入全部\n');
    process.exit(1);
  }
  
  const startTime = Date.now();
  
  // 導入餐廳資料
  if (choice === 'restaurants' || choice === 'all') {
    console.log('\n📍 開始導入餐廳資料...\n');
    
    const restaurants = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream('./data/allRestaurant.csv')
        .pipe(csv())
        .on('data', (row) => restaurants.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`共 ${restaurants.length} 筆餐廳資料\n`);
    
    for (const [index, restaurant] of restaurants.entries()) {
      await processRestaurant(restaurant);
      
      // 每10筆顯示進度
      if ((index + 1) % 10 === 0) {
        console.log(`\n進度: ${index + 1}/${restaurants.length} (${((index + 1) / restaurants.length * 100).toFixed(1)}%)\n`);
      }
      
      // 延遲避免 API 速率限制
      await delay(200);
    }
  }
  
  // 導入景點資料
  if (choice === 'attractions' || choice === 'all') {
    console.log('\n🏛️ 開始導入景點資料...\n');
    
    const attractions = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream('./data/all_spot.csv')
        .pipe(csv())
        .on('data', (row) => attractions.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`共 ${attractions.length} 筆景點資料\n`);
    
    for (const [index, attraction] of attractions.entries()) {
      await processAttraction(attraction);
      
      // 每10筆顯示進度
      if ((index + 1) % 10 === 0) {
        console.log(`\n進度: ${index + 1}/${attractions.length} (${((index + 1) / attractions.length * 100).toFixed(1)}%)\n`);
      }
      
      // 延遲避免 API 速率限制
      await delay(200);
    }
  }
  
  // 統計報告
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║           導入完成統計報告              ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`✓ 處理總數: ${stats.processed}`);
  console.log(`✓ 成功: ${stats.success}`);
  console.log(`❌ 失敗: ${stats.failed}`);
  console.log(`⚠️  跳過: ${stats.skipped}`);
  console.log(`⏱️  耗時: ${duration} 分鐘`);
  console.log('\n完成！🎉\n');
}

// 執行主函數
main().catch(error => {
  console.error('執行錯誤:', error);
  process.exit(1);
});
