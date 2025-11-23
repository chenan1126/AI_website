
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Mock params
const params = { location: '嘉義市' };

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
    } else if (location.includes('嘉義') || location.includes('阿里山')) {
      // 如果是阿里山或明確指定嘉義縣 -> 嘉義縣
      if (location.includes('阿里山') || location.includes('縣')) {
        filters.city = '嘉義縣';
      } else {
        // 否則預設為嘉義市 (例如只輸入「嘉義」)
        filters.city = '嘉義市';
      }
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
  return filters;
}

console.log('Input: 嘉義市');
console.log('Output:', extractFilters({ location: '嘉義市' }));

console.log('Input: 嘉義');
console.log('Output:', extractFilters({ location: '嘉義' }));

console.log('Input: 嘉義縣');
console.log('Output:', extractFilters({ location: '嘉義縣' }));
