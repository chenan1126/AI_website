/**
 * RAG Retriever 模組
 * 使用 Supabase Vector Database 檢索相關景點和餐廳
 */

// import dotenv from 'dotenv';
// dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { optimizeItinerary, calculateItineraryDistance } from './geoOptimizer.js';

// 初始化 Supabase 客戶端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 初始化 Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 生成查詢文字的向量嵌入
 * @param {string} text - 要嵌入的文字
 * @returns {Promise<number[]>} 768 維向量
 */
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

/**
 * 從查詢參數中提取篩選條件
 * @param {Object} params - 查詢參數
 * @returns {Object} 提取的篩選條件
 */
function extractFilters(params) {
  const filters = {};
  
  // 提取城市
  if (params.city) {
    const city = params.city;
    // 處理常見的城市名稱格式，統一使用「台」而非「臺」
    if (city.includes('台北') || city.includes('臺北')) {
      filters.city = '台北市';
    } else if (city.includes('新北')) {
      filters.city = '新北市';
    } else if (city.includes('桃園')) {
      filters.city = '桃園市';
    } else if (city.includes('台中') || city.includes('臺中')) {
      filters.city = '台中市';
    } else if (city.includes('台南') || city.includes('臺南')) {
      filters.city = '台南市';
    } else if (city.includes('高雄')) {
      filters.city = '高雄市';
    } else if (city.includes('基隆')) {
      filters.city = '基隆市';
    } else if (city.includes('新竹')) {
      // 需要判斷是新竹市還是新竹縣
      filters.city = city.includes('縣') ? '新竹縣' : '新竹市';
    } else if (city.includes('嘉義') || city.includes('阿里山')) {
      // 如果是阿里山或明確指定嘉義縣 -> 嘉義縣
      if (city.includes('阿里山') || city.includes('縣')) {
        filters.city = '嘉義縣';
      } else {
        // 否則預設為嘉義市 (例如只輸入「嘉義」)
        filters.city = '嘉義市';
      }
    } else if (city.includes('台東') || city.includes('臺東')) {
      filters.city = '台東縣';
    } else if (city.includes('宜蘭')) {
      filters.city = '宜蘭縣';
    } else if (city.includes('花蓮')) {
      filters.city = '花蓮縣';
    } else if (city.includes('屏東')) {
      filters.city = '屏東縣';
    } else if (city.includes('雲林')) {
      filters.city = '雲林縣';
    } else if (city.includes('南投')) {
      filters.city = '南投縣';
    } else if (city.includes('彰化')) {
      filters.city = '彰化縣';
    } else if (city.includes('苗栗')) {
      filters.city = '苗栗縣';
    } else if (city.includes('澎湖')) {
      filters.city = '澎湖縣';
    } else if (city.includes('金門')) {
      filters.city = '金門縣';
    } else if (city.includes('連江') || city.includes('馬祖')) {
      filters.city = '連江縣';
    } else {
      // 如果已經是完整城市名稱（包含「市」或「縣」），直接使用
      filters.city = city;
    }
  }
  
  // 提取類別偏好
  if (params.preferences && Array.isArray(params.preferences)) {
    // 將用戶偏好映射到資料庫類別
    const categoryMap = {
      '文化': '文化古蹟',
      '古蹟': '文化古蹟',
      '歷史': '文化古蹟',
      '博物館': '博物館展覽',
      '展覽': '博物館展覽',
      '自然': '自然景觀',
      '風景': '自然景觀',
      '山': '自然景觀',
      '海': '自然景觀',
      '步道': '自然景觀',
      '親子': '休閒娛樂',
      '遊樂': '休閒娛樂',
      '美食': '美食餐廳',
      '餐廳': '美食餐廳',
      '小吃': '美食餐廳',
      '工廠': '觀光工廠'
    };
    
    // 不要設定 category filter，讓語意搜尋自己決定
    // 這樣可以得到更多樣化的結果
    /*
    for (const pref of params.preferences) {
      for (const [key, value] of Object.entries(categoryMap)) {
        if (pref.includes(key)) {
          filters.category = value;
          break;
        }
      }
      if (filters.category) break;
    }
    */
  }
  
  return filters;
}

/**
 * 建立語意查詢文字
 * @param {Object} params - 查詢參數
 * @returns {string} 語意查詢文字
 */
function buildSemanticQuery(params) {
  const parts = [];
  
  // 加入旅遊天數和型態
  if (params.days) {
    parts.push(`${params.days}天的旅遊行程`);
  }
  
  if (params.tripType) {
    parts.push(params.tripType);
  }
  
  // 加入偏好
  if (params.preferences && Array.isArray(params.preferences)) {
    parts.push(params.preferences.join('、'));
  }
  
  // 加入地點
  if (params.city) {
    parts.push(`在${params.city}地區`);
  }
  
  // 加入特殊需求
  if (params.specialRequirements) {
    parts.push(params.specialRequirements);
  }
  
  return parts.join('，') || '推薦的觀光景點和美食餐廳';
}

/**
 * 向量搜尋景點和餐廳
 * @param {string} queryText - 查詢文字
 * @param {Object} filters - 篩選條件 { city?: string, category?: string }
 * @param {number} limit - 返回結果數量
 * @param {number} threshold - 相似度閾值 (0-1)
 * @returns {Promise<Array>} 相關景點/餐廳列表
 */
async function vectorSearch(queryText, filters = {}, limit = 10, threshold = 0.7) {
  try {
    // 生成查詢向量
    const queryEmbedding = await createEmbedding(queryText);
    
    // ⚠️ 關鍵修復：不在 RPC 層級過濾城市
    // 原因：Supabase 中的 city 欄位可能有空白、大小寫不一致等問題
    // 導致精確匹配 (=) 完全找不到任何結果
    // 改為在應用層過濾，更靈活且可控
    
    const rpcLimit = limit * 2; // 增加檢索數量以確保有足夠的候選
    const rpcThreshold = threshold * 0.9; // 略微降低閾值

    // 呼叫 Supabase 向量搜尋函數（不傳 filter_city，讓應用層自己過濾）
    const { data, error } = await supabase.rpc('match_attractions', {
      query_embedding: queryEmbedding,
      match_threshold: rpcThreshold,
      match_count: rpcLimit,
      filter_city: null,  // ✅ 改為 null，不在 RPC 層級過濾
      filter_category: filters.category || null
    });
    
    if (error) {
      console.error('向量搜尋失敗:', error);
      throw error;
    }
    
    let results = data || [];

    // 在應用層進行城市過濾（應對資料庫中可能的空白、大小寫差異等問題）
    if (filters.city) {
        // 統一處理「台」與「臺」
        const normalizeCity = (str) => str ? str.trim().toLowerCase().replace(/臺/g, '台') : '';
        const targetCity = normalizeCity(filters.city);
        
        const originalCount = results.length;
        
        results = results.filter(item => {
            const city = normalizeCity(item.city);
            const address = normalizeCity(item.address || '');
            const district = normalizeCity(item.district || '');
            
            // 精確匹配或前綴匹配
            return city === targetCity || city.startsWith(targetCity) || address.includes(targetCity) || district.includes(targetCity);
        });
        
        console.log(`🏙️ 城市過濾 (${filters.city}): 原始檢索 ${originalCount} 筆 -> 過濾後 ${results.length} 筆`);
    }

    // 特別處理嘉義市查詢：進一步精細化
    const isChiayiCityQuery = filters.city === '嘉義市';
    if (isChiayiCityQuery && results.length > 0) {
        results = results.filter(item => {
            const city = item.city ? item.city.trim() : '';
            const address = item.address || '';
            const district = item.district ? item.district.trim() : '';
            
            // 1. 絕對排除：明確標示為嘉義縣，或地址包含嘉義縣
            if (city === '嘉義縣' || address.includes('嘉義縣')) {
                return false;
            }

            // 2. 必須包含：嘉義市 (檢查 City 欄位或地址)
            if (city === '嘉義市' || address.includes('嘉義市')) {
                return true;
            }

            // 3. 寬鬆匹配：如果包含「嘉義」且行政區為東區或西區
            if (city.includes('嘉義') && (district === '東區' || district === '西區')) {
                return true;
            }
            
            return false;
        });
        console.log(`🔍 嘉義市精細過濾完成`);
    }
    
    return results;
  } catch (error) {
    console.error('vectorSearch 錯誤:', error.message);
    throw error;
  }
}

/**
 * 主要的 RAG 檢索函數
 * @param {Object} userParams - 用戶查詢參數
 * @param {Object} options - 檢索選項
 * @returns {Promise<Object>} 檢索結果
 */
export async function retrieveRelevantData(userParams, options = {}) {
  try {
    // 根據天數動態調整景點數量（每天 10 個景點 + 5 個餐廳）
    const days = userParams.days || 1;
    const attractionsPerDay = 10; // 每天 10 個景點
    const restaurantsPerDay = 5; // 每天 5 個餐廳
    
    const {
      attractionLimit = days * attractionsPerDay,  // 景點數量（動態調整）
      restaurantLimit = days * restaurantsPerDay,  // 餐廳數量（動態調整）
      threshold = 0.25,      // 降低預設閾值 (0.35 -> 0.25) 以獲得更多結果
      separateQueries = true // 是否分別查詢景點和餐廳
    } = options;
    
    // 提取篩選條件
    const filters = extractFilters(userParams);

    // 強制修正嘉義的邏輯：如果用戶原始查詢只說「嘉義」，則強制鎖定「嘉義市」
    // 這是為了回應 "輸入我要去嘉義玩=我要去嘉義市玩" 的需求
    if (userParams.specialRequirements) {
        const query = userParams.specialRequirements;
        // 如果查詢包含「嘉義」但沒有「縣」、「阿里山」、「梅山」等關鍵字
        if (query.includes('嘉義') && 
            !query.includes('嘉義縣') && 
            !query.includes('阿里山') && 
            !query.includes('梅山') &&
            !query.includes('山區')) {
            
            console.log('🔄 檢測到用戶意圖為「嘉義市區」，強制將篩選條件設為「嘉義市」');
            filters.city = '嘉義市';
        }
    }

    console.log('📍 篩選條件:', filters);
    
    let attractions = [];
    let restaurants = [];
    
    if (separateQueries) {
      // 分別查詢景點和餐廳
      
      const locationTerm = filters.city || '台灣';

      // 1. 查詢景點
      // 只使用明確的活動偏好，去除其他干擾
      let attractionQuery = '';
      if (userParams.activityPreferences && userParams.activityPreferences.length > 0) {
          console.log('🎯 使用明確的活動偏好進行景點搜尋:', userParams.activityPreferences);
          attractionQuery = `${locationTerm}的${userParams.activityPreferences.join('、')}`;
      } else {
          // 沒有偏好時，只查地點
          attractionQuery = `${locationTerm}景點`;
      }
      
      // 加入用戶原始需求 (去除偏好設定部分) - 已移除，避免關鍵字干擾
      // if (userParams.specialRequirements) { ... }
      
      console.log('🔍 景點查詢 (簡化版):', attractionQuery);
      
      // 2. 查詢餐廳
      let restaurantQuery = '';
      
      // 只使用明確的飲食偏好
      if (userParams.dietaryPreferences && userParams.dietaryPreferences.length > 0) {
          console.log('🎯 使用明確的飲食偏好進行餐廳搜尋:', userParams.dietaryPreferences);
          restaurantQuery = `${locationTerm}的${userParams.dietaryPreferences.join('、')}餐廳`;
      } else {
          // 沒有偏好時，只查地點美食
          restaurantQuery = `${locationTerm}美食餐廳`;
      }

      // 加入用戶原始需求 - 已移除
      // if (userParams.specialRequirements) { ... }

      console.log('🔍 餐廳查詢 (簡化版):', restaurantQuery);

      // 平行執行兩個查詢
      // 增加檢索數量 (x3) 以應對過濾
      let [attractionRawResults, restaurantResults] = await Promise.all([
        // 景點查詢：不限制 category，這樣會搜尋所有類別
        vectorSearch(
            attractionQuery,
            { city: filters.city }, // 不設定 category，這樣會搜尋所有類別
            attractionLimit * 3, // 增加檢索數量以應對過濾
            threshold
        ),
        // 餐廳查詢：明確指定 category 為美食餐廳
        vectorSearch(
            restaurantQuery,
            { city: filters.city, category: '美食餐廳' },
            restaurantLimit, // 使用設定的限制數量
            threshold * 0.8 // 餐廳使用更低的閾值以獲得更多選項
        )
      ]);
      
      // 立即過濾掉美食餐廳，保留所有其他類別作為景點
      attractions = attractionRawResults.filter(item => item.category !== '美食餐廳');
      console.log(`📊 RAG 初步檢索: 原始 ${attractionRawResults.length} 筆 -> 過濾餐廳後 ${attractions.length} 筆`);
      
      // ⚠️ 如果景點檢索結果過少，進行多層級回退搜尋
      if (attractions.length < 5) {
        console.log(`❌ 景點過少 (${attractions.length} 個)！進行第一層回退搜尋...`);
        
        // 回退策略 1：移除所有過濾條件，直接全文搜尋
        const fallbackQuery1 = `${filters.city}的觀光景點、旅遊景區、著名景點、風景區、文化、自然、歷史`;
        let fallbackResults1 = await vectorSearch(
          fallbackQuery1,
          { city: null }, // 完全不過濾城市
          days * 50, // 大幅增加數量
          threshold * 0.4 // 大幅降低閾值
        );
        
        // 過濾 fallback 1
        fallbackResults1 = fallbackResults1.filter(item => item.category !== '美食餐廳');
        
        if (fallbackResults1.length > 0) {
          // 在應用層進行城市過濾
          if (filters.city) {
            const targetCity = filters.city.trim().toLowerCase();
            fallbackResults1 = fallbackResults1.filter(item => {
              const city = item.city ? item.city.trim().toLowerCase() : '';
              const address = item.address || '';
              return city === targetCity || city.startsWith(targetCity) || address.includes(filters.city);
            });
          }
          
          // 合併結果 (去重)
          const existingIds = new Set(attractions.map(a => a.id || a.name));
          fallbackResults1.forEach(item => {
              if (!existingIds.has(item.id || item.name)) {
                  attractions.push(item);
                  existingIds.add(item.id || item.name);
              }
          });
          console.log(`📊 回退搜尋 1 後: 總共 ${attractions.length} 筆`);
        }
      }
      
      // 如果還是找不到，進行回退策略 2：超寬鬆查詢
      if (attractions.length < 5) {
        console.log(`⚠️ 景點仍過少，進行第二層回退搜尋（超寬鬆）...`);
        
        const fallbackQuery2 = `台灣景點`;
        let fallbackResults2 = await vectorSearch(
          fallbackQuery2,
          { city: null }, // 不過濾
          days * 100, // 非常大量檢索
          threshold * 0.1 // 極低閾值
        );
        
        // 過濾 fallback 2
        fallbackResults2 = fallbackResults2.filter(item => item.category !== '美食餐廳');
        
        if (fallbackResults2.length > 0) {
          // 在應用層進行城市過濾
          if (filters.city) {
            const targetCity = filters.city.trim().toLowerCase();
            fallbackResults2 = fallbackResults2.filter(item => {
              const city = item.city ? item.city.trim().toLowerCase() : '';
              const address = item.address || '';
              return city === targetCity || city.startsWith(targetCity) || address.includes(filters.city);
            });
          }
          
          // 合併結果 (去重)
          const existingIds = new Set(attractions.map(a => a.id || a.name));
          fallbackResults2.forEach(item => {
              if (!existingIds.has(item.id || item.name)) {
                  attractions.push(item);
                  existingIds.add(item.id || item.name);
              }
          });
          console.log(`📊 回退搜尋 2 後: 總共 ${attractions.length} 筆`);
        }
      }
      
      console.log(`📊 最終景點數量: ${attractions.length} 個`);
      if (attractions.length < 5) {
          console.log('⚠️ 警告: 非餐廳類景點過少，列出剩餘景點:', attractions.map(a => a.name).join(', '));
      }
      
      // 不再使用 .slice() 切割，讓所有找到的景點都能進入地理優化階段
      
      restaurants = restaurantResults;
      
    } else {
      // 單一查詢，混合景點和餐廳
      const query = buildSemanticQuery(userParams);
      console.log('🔍 綜合查詢:', query);
      
      const results = await vectorSearch(
        query,
        filters,
        attractionLimit + restaurantLimit,
        threshold
      );
      
      // 分離景點和餐廳
      attractions = results.filter(item => item.category !== '美食餐廳');
      restaurants = results.filter(item => item.category === '美食餐廳');
    }
    
    // 針對嘉義地區的特殊過濾：
    // 如果用戶沒有明確要求去「阿里山」或「山區」，則過濾掉遠距離的山區景點
    // 這適用於「嘉義市」和「嘉義縣」的查詢，避免一般嘉義旅遊被阿里山景點佔據
    const isChiayi = filters.city === '嘉義市' || filters.city === '嘉義縣';
    const userWantsMountain = userParams.specialRequirements && 
      (userParams.specialRequirements.includes('阿里山') || 
       userParams.specialRequirements.includes('梅山') || 
       userParams.specialRequirements.includes('奮起湖') ||
       userParams.specialRequirements.includes('山'));

    if (isChiayi && !userWantsMountain) {
      const mountainKeywords = ['阿里山', '梅山', '太平雲梯', '奮起湖', '瑞里', '達娜伊谷', '隙頂', '石棹', '二延平', '雲嶺之丘'];
      const mountainDistricts = ['阿里山鄉', '梅山鄉', '竹崎鄉', '番路鄉', '大埔鄉'];
      
      const filteredAttractions = attractions.filter(item => {
        // 1. 檢查行政區：如果是山區鄉鎮，直接過濾
        if (item.district && mountainDistricts.some(d => item.district.includes(d))) {
          return false;
        }
        
        // 2. 檢查關鍵字：如果名稱或描述包含山區關鍵字，過濾
        const text = (item.name + (item.description || '') + (item.address || '')).toLowerCase();
        if (mountainKeywords.some(kw => text.includes(kw))) return false;
        
        return true;
      });

      if (filteredAttractions.length > 0) {
          if (attractions.length > filteredAttractions.length) {
            console.log(`🏔️ 已過濾掉 ${attractions.length - filteredAttractions.length} 個嘉義山區景點，保留平原/市區景點`);
          }
          attractions = filteredAttractions;
      } else {
          console.warn(`⚠️ 嘉義山區過濾後結果為 0，為了避免無結果，保留原始 ${attractions.length} 個景點（包含山區）`);
          // 不更新 attractions，保留原始列表
      }

      // 同樣過濾餐廳
      const originalRestCount = restaurants.length;
      const filteredRestaurants = restaurants.filter(item => {
        // 1. 檢查行政區
        if (item.district && mountainDistricts.some(d => item.district.includes(d))) {
          return false;
        }
        // 2. 檢查關鍵字
        const text = (item.name + (item.description || '') + (item.address || '')).toLowerCase();
        if (mountainKeywords.some(kw => text.includes(kw))) return false;
        return true;
      });

      if (filteredRestaurants.length > 0) {
          restaurants = filteredRestaurants;
          if (originalRestCount > restaurants.length) {
            console.log(`🍽️ 已過濾掉 ${originalRestCount - restaurants.length} 個嘉義山區餐廳`);
          }
      } else if (originalRestCount > 0) {
           console.warn(`⚠️ 嘉義山區餐廳過濾後結果為 0，保留原始 ${originalRestCount} 個餐廳`);
           // 不更新 restaurants
      }
    }

    console.log(`✅ RAG 檢索完成: ${attractions.length} 個景點, ${restaurants.length} 家餐廳`);
    console.log(`📍 這些景點將進入地理優化階段 (15km 過濾 + K-Means 分群)`);
    
    return {
      attractions,
      restaurants,
      filters,
      summary: {
        totalAttractions: attractions.length,
        totalRestaurants: restaurants.length,
        city: filters.city,
        category: filters.category
      }
    };
    
  } catch (error) {
    console.error('RAG 檢索失敗:', error.message);
    throw error;
  }
}

/**
 * 格式化檢索結果為 Prompt 文字（含地理優化）
 * @param {Object} retrievalResult - retrieveRelevantData 的返回結果
 * @param {number} days - 旅遊天數
 * @returns {string} 格式化的文字
 */
export function formatRetrievalForPrompt(retrievalResult, days = null) {
  const { attractions, restaurants, filters } = retrievalResult;
  
  let prompt = '# 可用的真實景點和餐廳資料\n\n';
  prompt += '以下是從資料庫檢索出的真實景點和餐廳，**已按地理位置優化分組**，請充分利用這些資源規劃豐富的行程：\n\n';
  
  // 如果有天數，進行地理優化分組
  let useGeoOptimization = false;
  if (days && days > 0 && attractions.length > 0) {
    const validCoordsCount = attractions.filter(a => (a.lat || a.latitude) && (a.lng || a.longitude)).length;
    if (validCoordsCount >= 3) useGeoOptimization = true;
    else console.warn(`⚠️ 景點座標資料不足 (${validCoordsCount}/${attractions.length})，跳過地理優化`);
  }

  if (useGeoOptimization) {
    const dailyItinerary = optimizeItinerary(attractions, days, {
      maxDistanceFromCenter: 30,  // 放寬到 30 公里，避免過度過濾
      sortByProximity: true,      // 按鄰近順序排列
      minLocationsPerDay: 5       // 配合每天抓 15 個，降低保底數量
    });
    
    // 檢查優化後是否還有景點
    const totalOptimizedLocations = dailyItinerary.reduce((sum, day) => sum + day.locations.length, 0);
    if (totalOptimizedLocations === 0) {
        console.warn('⚠️ 地理優化後景點數量為 0，回退到原始列表模式');
        useGeoOptimization = false;
    }

    const stats = calculateItineraryDistance(dailyItinerary);
    
    prompt += `## 🗺️ 地理優化結果\n\n`;
    prompt += `- 總交通距離: ${stats.totalDistance.toFixed(1)} km\n`;
    prompt += `- 平均每天距離: ${(stats.totalDistance / days).toFixed(1)} km\n`;
    prompt += `- 總候選景點: ${attractions.length} 個\n\n`;
    
    // 按天數輸出景點
    dailyItinerary.forEach((day, dayIndex) => {
      prompt += `### 第 ${day.day} 天建議景點 (${day.locations.length} 個可選)\n\n`;
    prompt += `**區域中心**: 緯度 ${day.centroid.lat.toFixed(4)}, 經度 ${day.centroid.lng.toFixed(4)}\n`;
    prompt += `**交通距離**: ${stats.dailyDistances[dayIndex].distance.toFixed(1)} km\n`;
    prompt += `**⚠️ 最低要求**: 必須選擇至少 3-4 個景點\n`;
    prompt += `**建議選擇**: 從以下 ${day.locations.length} 個景點中選擇 4-6 個，安排完整的一日行程。請優先使用這些景點，不要浪費。\n\n`;      day.locations.forEach((attr, index) => {
        prompt += `${index + 1}. **${attr.name}**\n`;
        prompt += `   - 類別: ${attr.category}\n`;
        prompt += `   - 地址: ${attr.city} ${attr.district || ''}\n`;
        prompt += `   - 座標: (${(attr.lat || attr.latitude).toFixed(4)}, ${(attr.lng || attr.longitude).toFixed(4)})\n`;
        if (attr.description) {
          const desc = attr.description.substring(0, 80);
          prompt += `   - 描述: ${desc}${attr.description.length > 80 ? '...' : ''}\n`;
        }
        if (attr.features && attr.features.length > 0) {
          prompt += `   - 特色: ${attr.features.slice(0, 3).join(', ')}\n`;
        }
        if (attr.rating) {
          prompt += `   - 評分: ${attr.rating}/5.0\n`;
        }
        if (attr.opening_hours) {
          prompt += `   - 營業時間: ${typeof attr.opening_hours === 'string' ? attr.opening_hours : '請查詢'}\n`;
        }
        prompt += `   - 相關度: ${(attr.similarity * 100).toFixed(1)}%\n\n`;
      });
      
      prompt += '\n';
    });
    
    prompt += `\n**重要規劃原則**: \n`;
    prompt += `1. 以上景點已按地理位置分組優化，每天有 ${Math.round(attractions.length / days)} 個候選景點\n`;
    prompt += `2. 請為每天選擇 4-6 個景點，確保行程豐富但不過於緊湊\n`;
    prompt += `3. 每個景點建議停留 1-2 小時，用餐 1-1.5 小時\n`;
    prompt += `4. 早上 9:00 開始，晚上 18:00-19:00 結束，妥善安排時間\n`;
    prompt += `5. 景點順序已優化為最短路徑，請按照順序安排\n\n`;
    
  } 
  
  if (!useGeoOptimization) {
    // 沒有天數或景點，或者地理優化失敗，使用原本的格式
    if (attractions.length > 0) {
      prompt += '## 景點列表\n\n';
      attractions.forEach((attr, index) => {
        prompt += `${index + 1}. **${attr.name}**\n`;
        prompt += `   - 類別: ${attr.category}\n`;
        prompt += `   - 地址: ${attr.city} ${attr.district || ''}\n`;
        if (attr.description) {
          // 縮減描述長度以節省 Token
          const desc = attr.description.length > 100 ? attr.description.substring(0, 100) + '...' : attr.description;
          prompt += `   - 描述: ${desc}\n`;
        }
        if (attr.features && attr.features.length > 0) {
          prompt += `   - 特色: ${attr.features.slice(0, 2).join(', ')}\n`;
        }
        if (attr.opening_hours) {
           // 簡化營業時間顯示
           const hours = typeof attr.opening_hours === 'string' ? attr.opening_hours : '有營業';
           prompt += `   - 營業時間: ${hours.substring(0, 20)}${hours.length > 20 ? '...' : ''}\n`;
        }
        prompt += '\n';
      });
    }
  }
  
  if (restaurants.length > 0) {
    prompt += '## 🍽️ 餐廳列表（僅供午晚餐）\n\n';
    restaurants.forEach((rest, index) => {
      prompt += `${index + 1}. **${rest.name}**\n`;
      prompt += `   - 類別: ${rest.category}\n`;
      prompt += `   - 地址: ${rest.city} ${rest.district || ''}\n`;
      if (rest.description) {
        const desc = rest.description.length > 80 ? rest.description.substring(0, 80) + '...' : rest.description;
        prompt += `   - 描述: ${desc}\n`;
      }
      if (rest.features && rest.features.length > 0) {
        prompt += `   - 特色: ${rest.features.slice(0, 2).join(', ')}\n`;
      }
      if (rest.rating) {
        prompt += `   - 評分: ${rest.rating}\n`;
      }
      prompt += '\n';
    });
  }
  
  prompt += '\n---\n\n';
  prompt += '## ✅ 規劃簡要指南\n\n';
  prompt += '1. **每天 3-4 個景點** + **2 餐** (午/晚)。\n';
  prompt += '2. **時間連貫**，09:00-19:00，避免空檔。\n';
  prompt += '3. **地理順路**，不要來回奔波。\n';
  prompt += '4. **必須使用**上述提供的真實地點。\n\n';
  
  return prompt;
}

/**
 * 簡化版：直接返回格式化的 Prompt 文字（含地理優化）
 * @param {Object} userParams - 用戶查詢參數
 * @param {Object} options - 檢索選項
 * @returns {Promise<string>} 格式化的 Prompt 文字
 */
export async function getRAGContext(userParams, options = {}) {
  const retrievalResult = await retrieveRelevantData(userParams, options);
  const days = userParams.days || null;
  return formatRetrievalForPrompt(retrievalResult, days);
}



// 預設導出
export default {
  retrieveRelevantData,
  formatRetrievalForPrompt,
  getRAGContext,
  vectorSearch,
  createEmbedding
};
