/**
 * RAG Retriever 模組
 * 使用 Supabase Vector Database 檢索相關景點和餐廳
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 初始化 Supabase 客戶端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
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
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
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
  if (params.location || params.city) {
    const location = params.location || params.city;
    // 處理常見的城市名稱格式，統一使用「台」而非「臺」
    if (location.includes('台北') || location.includes('臺北')) {
      filters.city = '台北市';
    } else if (location.includes('新北')) {
      filters.city = '新北市';
    } else if (location.includes('桃園')) {
      filters.city = '桃園市';
    } else if (location.includes('台中') || location.includes('臺中')) {
      filters.city = '台中市';
    } else if (location.includes('台南') || location.includes('臺南')) {
      filters.city = '台南市';
    } else if (location.includes('高雄')) {
      filters.city = '高雄市';
    } else if (location.includes('基隆')) {
      filters.city = '基隆市';
    } else if (location.includes('新竹')) {
      // 需要判斷是新竹市還是新竹縣
      filters.city = location.includes('縣') ? '新竹縣' : '新竹市';
    } else if (location.includes('嘉義')) {
      // 需要判斷是嘉義市還是嘉義縣
      filters.city = location.includes('縣') ? '嘉義縣' : '嘉義市';
    } else if (location.includes('台東') || location.includes('臺東')) {
      filters.city = '台東縣';
    } else if (location.includes('宜蘭')) {
      filters.city = '宜蘭縣';
    } else if (location.includes('花蓮')) {
      filters.city = '花蓮縣';
    } else if (location.includes('屏東')) {
      filters.city = '屏東縣';
    } else if (location.includes('雲林')) {
      filters.city = '雲林縣';
    } else if (location.includes('南投')) {
      filters.city = '南投縣';
    } else if (location.includes('彰化')) {
      filters.city = '彰化縣';
    } else if (location.includes('苗栗')) {
      filters.city = '苗栗縣';
    } else if (location.includes('澎湖')) {
      filters.city = '澎湖縣';
    } else if (location.includes('金門')) {
      filters.city = '金門縣';
    } else if (location.includes('連江') || location.includes('馬祖')) {
      filters.city = '連江縣';
    } else {
      // 如果已經是完整城市名稱（包含「市」或「縣」），直接使用
      filters.city = location;
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
  if (params.location) {
    parts.push(`在${params.location}地區`);
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
    
    // 呼叫 Supabase 向量搜尋函數
    const { data, error } = await supabase.rpc('match_attractions', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      filter_city: filters.city || null,
      filter_category: filters.category || null
    });
    
    if (error) {
      console.error('向量搜尋失敗:', error);
      throw error;
    }
    
    return data || [];
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
    const {
      attractionLimit = 15,  // 景點數量
      restaurantLimit = 10,  // 餐廳數量
      threshold = 0.7,       // 相似度閾值
      separateQueries = true // 是否分別查詢景點和餐廳
    } = options;
    
    // 提取篩選條件
    const filters = extractFilters(userParams);
    console.log('📍 篩選條件:', filters);
    
    let attractions = [];
    let restaurants = [];
    
    if (separateQueries) {
      // 分別查詢景點和餐廳
      
      // 1. 查詢景點
      const attractionQuery = buildSemanticQuery({
        ...userParams,
        preferences: userParams.preferences?.filter(p => !p.includes('美食') && !p.includes('餐廳'))
      });
      console.log('🔍 景點查詢:', attractionQuery);
      
      const attractionFilters = {
        city: filters.city // 只使用城市篩選，不限制類別
      };
      
      attractions = await vectorSearch(
        attractionQuery,
        attractionFilters,
        attractionLimit,
        threshold
      );
      
      // 過濾掉美食餐廳
      attractions = attractions.filter(item => item.category !== '美食餐廳');
      
      // 2. 查詢餐廳
      const restaurantQuery = `${filters.city || '台灣'}的特色美食餐廳、在地小吃、推薦料理`;
      console.log('🔍 餐廳查詢:', restaurantQuery);
      
      restaurants = await vectorSearch(
        restaurantQuery,
        { city: filters.city, category: '美食餐廳' },
        restaurantLimit,
        threshold * 0.85 // 餐廳使用較低的閾值
      );
      
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
    
    console.log(`✅ 檢索完成: ${attractions.length} 個景點, ${restaurants.length} 家餐廳`);
    
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
 * 格式化檢索結果為 Prompt 文字
 * @param {Object} retrievalResult - retrieveRelevantData 的返回結果
 * @returns {string} 格式化的文字
 */
export function formatRetrievalForPrompt(retrievalResult) {
  const { attractions, restaurants } = retrievalResult;
  
  let prompt = '# 可用的真實景點和餐廳資料\n\n';
  prompt += '以下是從資料庫檢索出的真實景點和餐廳，請優先從這些選項中規劃行程：\n\n';
  
  if (attractions.length > 0) {
    prompt += '## 景點列表\n\n';
    attractions.forEach((attr, index) => {
      prompt += `${index + 1}. **${attr.name}**\n`;
      prompt += `   - 類別: ${attr.category}\n`;
      prompt += `   - 地址: ${attr.city} ${attr.district || ''}\n`;
      if (attr.description) {
        prompt += `   - 描述: ${attr.description}\n`;
      }
      if (attr.features && attr.features.length > 0) {
        prompt += `   - 特色: ${attr.features.join(', ')}\n`;
      }
      if (attr.phone) {
        prompt += `   - 電話: ${attr.phone}\n`;
      }
      if (attr.website) {
        prompt += `   - 網站: ${attr.website}\n`;
      }
      if (attr.opening_hours) {
        prompt += `   - 營業時間: ${JSON.stringify(attr.opening_hours)}\n`;
      }
      prompt += `   - 相關度: ${(attr.similarity * 100).toFixed(1)}%\n\n`;
    });
  }
  
  if (restaurants.length > 0) {
    prompt += '## 餐廳列表\n\n';
    restaurants.forEach((rest, index) => {
      prompt += `${index + 1}. **${rest.name}**\n`;
      prompt += `   - 類別: ${rest.category}\n`;
      prompt += `   - 地址: ${rest.city} ${rest.district || ''} ${rest.address || ''}\n`;
      if (rest.description) {
        prompt += `   - 描述: ${rest.description}\n`;
      }
      if (rest.features && rest.features.length > 0) {
        prompt += `   - 特色: ${rest.features.join(', ')}\n`;
      }
      if (rest.phone) {
        prompt += `   - 電話: ${rest.phone}\n`;
      }
      prompt += `   - 相關度: ${(rest.similarity * 100).toFixed(1)}%\n\n`;
    });
  }
  
  prompt += '\n---\n\n';
  prompt += '**重要指示**: 請優先使用以上真實資料規劃行程。如果需要更多景點，可以適度補充，但必須標註哪些是資料庫中的真實景點，哪些是建議補充的。\n\n';
  
  return prompt;
}

/**
 * 簡化版：直接返回格式化的 Prompt 文字
 * @param {Object} userParams - 用戶查詢參數
 * @param {Object} options - 檢索選項
 * @returns {Promise<string>} 格式化的 Prompt 文字
 */
export async function getRAGContext(userParams, options = {}) {
  const retrievalResult = await retrieveRelevantData(userParams, options);
  return formatRetrievalForPrompt(retrievalResult);
}

// 預設導出
export default {
  retrieveRelevantData,
  formatRetrievalForPrompt,
  getRAGContext,
  vectorSearch,
  createEmbedding
};
