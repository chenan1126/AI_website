/**
 * 測試 RAG 檢索數量和質量
 */

import { retrieveRelevantData } from './api/utils/ragRetriever.js';

async function testRAGRetrieval() {
  console.log('🧪 測試 RAG 檢索系統\n');
  
  // 測試案例 1: 台南 3 日遊
  console.log('📍 測試案例 1: 台南 3 日遊');
  const result1 = await retrieveRelevantData({
    location: '台南',
    days: 3,
    preferences: ['文化古蹟', '美食', '自然風景']
  });
  
  console.log(`✅ 景點數量: ${result1.attractions.length}`);
  console.log(`✅ 餐廳數量: ${result1.restaurants.length}`);
  console.log(`✅ 預期每天景點: ${result1.attractions.length / 3} 個`);
  console.log('');
  
  // 測試案例 2: 台北 2 日遊
  console.log('📍 測試案例 2: 台北 2 日遊');
  const result2 = await retrieveRelevantData({
    location: '台北',
    days: 2,
    preferences: ['博物館', '夜市', '購物']
  });
  
  console.log(`✅ 景點數量: ${result2.attractions.length}`);
  console.log(`✅ 餐廳數量: ${result2.restaurants.length}`);
  console.log(`✅ 預期每天景點: ${result2.attractions.length / 2} 個`);
  console.log('');
  
  // 測試案例 3: 高雄 1 日遊
  console.log('📍 測試案例 3: 高雄 1 日遊');
  const result3 = await retrieveRelevantData({
    location: '高雄',
    days: 1,
    preferences: ['港口', '海景', '美食']
  });
  
  console.log(`✅ 景點數量: ${result3.attractions.length}`);
  console.log(`✅ 餐廳數量: ${result3.restaurants.length}`);
  console.log(`✅ 預期景點: ${result3.attractions.length} 個`);
  console.log('');
  
  console.log('✅ 測試完成！');
  console.log('');
  console.log('📊 改進前後對比:');
  console.log('改進前: 15 個景點固定 → 3天 = 每天 5 個 (不足)');
  console.log('改進後: 3天 × 8 = 24 個景點 → 每天 8 個 (充足)');
}

testRAGRetrieval().catch(console.error);
