// api/_utils.js
// 
// 🛠️ 工具函數集合
// 包含天氣、地圖、路線規劃、日期時間處理等功能
//
// ============================================
// 📑 目錄索引 (Table of Contents)
// ============================================
// 
// 🔑 環境變數與常數配置
//    - API Keys
//    - CITY_MAPPING (城市到天氣資料集映射)
//
// ☁️ 天氣相關功能
//    - getWeatherRangeSync (內部)
//    - getWeatherSync (內部)
//    - getWeatherForDateFromForecast (內部)
//    - getMultiDayWeatherSync (導出)
//
// 🗺️ Google Maps 相關功能
//    - getPlaceDetailsSync (導出)
//    - detectTransportationMode (內部)
//    - calculateRouteDistanceAndTimeSync (導出)
//
// 📊 統計與評分計算功能
//    - calculateWilsonScore (導出)
//    - parseTimeToMinutes (導出)
//    - calculatePlayingTime (導出)
//
// 📅 日期時間處理功能
//    - calculateTripDates (導出)
//
// 🏷️ 輔助工具函數
//    - isLocationSpecific (導出)
//
// ============================================

// ============================================
// 🔑 環境變數與常數配置
// ============================================

// API Keys - 從環境變數讀取
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const CWA_AUTH = process.env.CWA_API_KEY || 'CWA-F3FCE1AF-CFF8-4531-86AD-379B18FE38A2';

/**
 * 帶有超時功能的 fetch 包裝器
 * @param {string} url 
 * @param {object} options 
 * @param {number} timeout 
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(id);
    }
}

// 城市名稱到天氣資料集 ID 的映射
const CITY_MAPPING = {
    "台北": "F-D0047-063", "台北市": "F-D0047-063", "臺北": "F-D0047-063", "臺北市": "F-D0047-063",
    "台中": "F-D0047-075", "台中市": "F-D0047-075", "臺中": "F-D0047-075", "臺中市": "F-D0047-075",
    "台南": "F-D0047-079", "台南市": "F-D0047-079", "臺南": "F-D0047-079", "臺南市": "F-D0047-079",
    "高雄": "F-D0047-067", "高雄市": "F-D0047-067",
    "新北": "F-D0047-071", "新北市": "F-D0047-071",
    "桃園": "F-D0047-007", "桃園市": "F-D0047-007",
    "新竹市": "F-D0047-055", "新竹縣": "F-D0047-011", "新竹": "F-D0047-055",
    "苗栗": "F-D0047-015", "苗栗縣": "F-D0047-015",
    "彰化": "F-D0047-019", "彰化縣": "F-D0047-019",
    "南投": "F-D0047-023", "南投縣": "F-D0047-023",
    "雲林": "F-D0047-027", "雲林縣": "F-D0047-027",
    "嘉義市": "F-D0047-059", "嘉義縣": "F-D0047-031", "嘉義": "F-D0047-059",
    "屏東": "F-D0047-035", "屏東縣": "F-D0047-035",
    "宜蘭": "F-D0047-003", "宜蘭縣": "F-D0047-003",
    "花蓮": "F-D0047-043", "花蓮縣": "F-D0047-043",
    "台東": "F-D0047-039", "台東縣": "F-D0047-039", "臺東": "F-D0047-039", "臺東縣": "F-D0047-039",
    "澎湖": "F-D0047-047", "澎湖縣": "F-D0047-047",
    "金門": "F-D0047-087", "金門縣": "F-D0047-087",
    "連江": "F-D0047-083", "連江縣": "F-D0047-083",
    "基隆": "F-D0047-051", "基隆市": "F-D0047-051",
};

// ============================================
// ☁️ 天氣相關功能 (Weather Functions)
// ============================================
// 功能：
// - getWeatherRangeSync: 獲取時間範圍內的天氣資料
// - getWeatherSync: 獲取單日天氣資料
// - getWeatherForDateFromForecast: 從預報數據中提取特定日期天氣
// - getMultiDayWeatherSync: 獲取多日天氣資料（對外導出）
// ============================================

/**
 * 標準化城市名稱，處理「臺」和「台」的異體字
 * @param {string} cityName - 原始城市名稱
 * @returns {string} 標準化後的城市名稱
 */
function normalizeCityName(cityName) {
    if (!cityName) return cityName;
    // 將「臺」統一轉換為「台」，以匹配 CITY_MAPPING 的 key
    return cityName.replace(/臺/g, '台');
}

/**
 * 異步獲取指定城市和日期範圍的天氣資訊（使用 timeFrom 和 timeTo）
 * @param {string} cityName - 城市中文名（可含市/縣）
 * @param {string} timeFrom - 開始時間 (YYYY-MM-DDTHH:mm:ss)
 * @param {string} timeTo - 結束時間 (YYYY-MM-DDTHH:mm:ss)
 * @returns {Promise<object>} 天氣資訊物件或錯誤物件
 */
async function getWeatherRangeSync(cityName, timeFrom, timeTo) {
    console.log(`[Weather API] 正在為城市「${cityName}」獲取 ${timeFrom} 到 ${timeTo} 的天氣...`);
    
    try {
        // 標準化城市名稱（處理「臺」和「台」的異體字）
        const normalizedCity = normalizeCityName(cityName);
        const datasetId = CITY_MAPPING[normalizedCity] || "F-D0047-063";
        if (cityName !== normalizedCity) {
            // console.log(`[Weather API] 城市名稱標準化: "${cityName}" -> "${normalizedCity}"`);
        }
        // console.log(`[Weather API] 城市: ${normalizedCity}, 使用 datasetId: ${datasetId}`);
        
        const url = new URL(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/${datasetId}`);
        url.searchParams.append('Authorization', CWA_AUTH);
        url.searchParams.append('format', 'JSON');
        url.searchParams.append('timeFrom', timeFrom);
        url.searchParams.append('timeTo', timeTo);

        // console.log(`[Weather API] 請求 URL: ${url.toString()}`);

        const response = await fetchWithTimeout(url.toString(), {}, 10000);
        if (!response.ok) {
            console.error(`[Weather API] HTTP 錯誤: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error(`[Weather API] 錯誤回應內容: ${errorText.substring(0, 500)}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.success !== 'true') {
            console.error(`[Weather API] API 回應失敗:`, JSON.stringify(data, null, 2));
            return { error: "獲取天氣資料失敗" };
        }

        console.log(`[Weather API] API 調用成功，有 ${data.records?.Locations?.[0]?.Location?.length || 0} 個地點`);
        return data;

    } catch (e) {
        console.error(`[Weather API] 獲取天氣資訊時發生錯誤: ${e.message}`);
        console.error(`[Weather API] 錯誤堆棧:`, e.stack);
        return { error: `獲取天氣資訊失敗: ${e.message}` };
    }
}



/**
 * 從預報數據中提取指定日期的天氣資訊
 * @param {object} data - CWA API 回傳的完整資料
 * @param {string} dateStr - 目標日期字串 (YYYY-MM-DD)
 * @returns {object} 整理後的單日天氣資訊
 */
function getWeatherForDateFromForecast(data, dateStr) {
    try {
        // console.log(`[Weather Parser] 開始解析日期 ${dateStr} 的天氣數據...`);
        
        const targetDate = new Date(dateStr);
        targetDate.setHours(0, 0, 0, 0);

        const locationData = data?.records?.Locations?.[0]?.Location?.[0];
        if (!locationData) {
            console.error(`[Weather Parser] 無法找到 locationData`);
            return { error: "無天氣資料" };
        }

        const weatherElements = locationData.WeatherElement;
        // console.log(`[Weather Parser] 找到 ${weatherElements?.length || 0} 個天氣元素`);
        
        const dateWeatherData = [];

        for (const element of weatherElements) {
            let matchedSlots = 0;
            for (const slot of element.Time) {
                const startTime = new Date(slot.StartTime);
                const endTime = new Date(slot.EndTime);
                
                // 從 StartTime 和 EndTime 中提取日期字串（YYYY-MM-DD），避免時區問題
                const startDateStr = slot.StartTime.split('T')[0]; // 取 "2025-10-15"
                const endDateStr = slot.EndTime.split('T')[0]; // 取 "2025-10-15"
                
                // 檢查目標日期是否在這個時間槽的範圍內
                const targetDate = new Date(dateStr);
                const isDateInRange = targetDate >= startTime && targetDate < endTime;
                const isDateMatch = startDateStr === dateStr || endDateStr === dateStr || isDateInRange;
                
                if (isDateMatch) {
                    
                    matchedSlots++;
                    const valueObj = slot.ElementValue[0];
                    let value;
                    let extraData = {}; // 用於存儲額外資訊
                    
                    // 根據 Python 程式碼的邏輯提取 value
                    if (element.ElementName === '天氣現象') value = valueObj.Weather;
                    else if (['溫度', '平均溫度', '最高溫度', '最低溫度', '最高體感溫度', '最低體感溫度'].includes(element.ElementName)) value = valueObj.Temperature || valueObj.MaxTemperature || valueObj.MinTemperature || valueObj.MaxApparentTemperature || valueObj.MinApparentTemperature;
                    else if (['相對濕度', '平均相對濕度'].includes(element.ElementName)) value = valueObj.RelativeHumidity;
                    else if (['12小時降雨機率'].includes(element.ElementName)) value = valueObj.ProbabilityOfPrecipitation;
                    else if (element.ElementName === '紫外線指數') {
                        value = valueObj.UVIndex;
                        extraData.uvExposureLevel = valueObj.UVExposureLevel; // 保存曝曬等級
                    }
                    else if (element.ElementName === '天氣預報綜合描述') value = valueObj.WeatherDescription;
                    else value = valueObj.value;

                    if (value) {
                         dateWeatherData.push({
                            element: element.ElementName,
                            value: value,
                            ...extraData // 展開額外資訊
                        });
                    }
                }
            }
            if (matchedSlots > 0) {
                // console.log(`[Weather Parser] 元素「${element.ElementName}」匹配到 ${matchedSlots} 個時間槽`);
            }
        }

        // console.log(`[Weather Parser] 日期 ${dateStr} 共收集到 ${dateWeatherData.length} 筆天氣數據`);

        if (dateWeatherData.length === 0) {
            console.warn(`[Weather Parser] 找不到 ${dateStr} 的天氣預報資料，返回默認數據`);
            // 返回默認的天氣數據，而不是錯誤
            return {
                condition: '晴天',
                temp: '25',
                min_temp: '22',
                max_temp: '28',
                rain_chance: '10',
                uvi: '5',
                uv_exposure_level: '中等',
                description: '天氣資訊暫時無法獲取，請以實際天氣為準。',
                icon: '☀️',
                date: dateStr,
                is_default: true // 標記這是默認數據
            };
        }

        // 統計數據
        const aggregate = (elementNames) => {
            const values = dateWeatherData
                .filter(item => elementNames.includes(item.element) && item.value && item.value !== '-')
                .map(item => parseFloat(item.value))
                .filter(val => !isNaN(val)); // 過濾掉 NaN 值
            return values.length > 0 ? values : null;
        };
        
        const conditions = dateWeatherData.filter(item => item.element === '天氣現象').map(item => item.value);
        const mainCondition = conditions.length > 0 ? conditions.reduce((a, b, i, arr) => (arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b), null) : '無資料';

        const temps = aggregate(['溫度', '平均溫度']);
        const maxTemps = aggregate(['最高溫度']);
        const minTemps = aggregate(['最低溫度']);
        const rainProbs = aggregate(['12小時降雨機率']);

        const avgTemp = temps ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : '無資料';
        const maxTemp = maxTemps ? Math.round(Math.max(...maxTemps)) : '無資料';
        const minTemp = minTemps ? Math.round(Math.min(...minTemps)) : '無資料';
        const rainChance = rainProbs && rainProbs.length > 0 ? Math.round(Math.max(...rainProbs)) : '無資料';

        const uviValues = aggregate(['紫外線指數']);
        // 紫外線指數一天只有一個值，直接取第一個
        const uvi = uviValues && uviValues.length > 0 ? uviValues[0] : '無資料';
        
        // 提取紫外線曝曬等級
        const uviData = dateWeatherData.find(item => item.element === '紫外線指數');
        const uvExposureLevel = uviData?.uvExposureLevel || null;

        const descriptions = dateWeatherData.filter(item => item.element === '天氣預報綜合描述').map(item => item.value);
        let weatherDescription = descriptions.length > 0 ? descriptions[0] : '無特別天氣提醒。';

        let icon = '☀️';
        if (mainCondition.includes('晴')) icon = '☀️';
        else if (mainCondition.includes('雨')) icon = '🌧️';
        else if (mainCondition.includes('雲') || mainCondition.includes('陰')) icon = '☁️';
        else if (mainCondition.includes('雷')) icon = '⛈️';
        else if (mainCondition.includes('雪')) icon = '❄️';

        return {
            condition: mainCondition,
            temp: avgTemp,
            min_temp: minTemp,
            max_temp: maxTemp,
            rain_chance: rainChance,
            uvi: uvi,
            uv_exposure_level: uvExposureLevel, // 紫外線曝曬等級
            description: weatherDescription,
            icon: icon,
            date: dateStr
        };

    } catch (e) {
        return { error: `解析天氣預報失敗: ${e.message}` };
    }
}

/**
 * 獲取多日期的天氣資訊
 * @param {string} cityName - 城市中文名
 * @param {string[]} dates - 日期字串陣列 (YYYY-MM-DD)
 * @returns {Promise<object>} 一個以日期為鍵，天氣資訊為值的物件
 */
export async function getMultiDayWeatherSync(cityName, dates) {
    if (!dates || dates.length === 0) {
        console.log('[Weather] 沒有提供日期');
        return {};
    }
    
    // 找到日期範圍
    const sortedDates = [...dates].sort();
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    
    // 設置 timeFrom 和 timeTo
    const timeFrom = `${firstDate}T00:00:00`;
    // 結束時間設為最後一天的 23:59:59，確保包含整天
    const timeTo = `${lastDate}T23:59:59`;
    
    // console.log(`[Weather] 城市: ${cityName}, 日期範圍: ${dates.join(', ')}`);
    // console.log(`[Weather] 使用時間範圍獲取天氣: ${timeFrom} 到 ${timeTo}`);
    
    try {
        // 使用單次 API 調用獲取整個日期範圍的天氣
        const data = await getWeatherRangeSync(cityName, timeFrom, timeTo);
        
        if (data.error) {
            console.error(`[Weather] 獲取天氣範圍數據失敗:`, data.error);
            return {};
        }
        
        console.log(`[Weather] API 調用成功，開始解析各日期的天氣...`);
        
        // 為每個日期提取天氣資訊
        const weatherData = {};
        for (const date of dates) {
            // console.log(`[Weather] 正在解析日期 ${date} 的天氣...`);
            const weather = getWeatherForDateFromForecast(data, date);
            if (weather && !weather.error) {
                // console.log(`[Weather] 日期 ${date} 的天氣解析成功:`, weather);
                weatherData[date] = weather;
            } else {
                console.warn(`[Weather] 日期 ${date} 的天氣解析失敗:`, weather?.error);
            }
        }
        
        console.log(`[Weather] 最終天氣數據:`, Object.keys(weatherData).length, '天有數據');
        return weatherData;
    } catch (e) {
        console.error(`[Weather] 獲取多日天氣時發生錯誤: ${e.message}`);
        console.error(`[Weather] 錯誤堆棧:`, e.stack);
        return {};
    }
}

// ============================================
// 🗺️ Google Maps 相關功能 (Google Maps Functions)
// ============================================
// 功能：
// - getPlaceDetailsSync: 獲取景點詳細資訊（對外導出）
// - detectTransportationMode: 智能檢測交通方式
// - calculateRouteDistanceAndTimeSync: 計算路線距離和時間（對外導出）
// ============================================

/**
 * 異步獲取 Google Maps 景點詳情
 * @param {string} placeName - 景點名稱
 * @param {string} [location="台灣"] - 地點偏好
 * @returns {Promise<object>} 景點詳情或錯誤物件
 */
export async function getPlaceDetailsSync(placeName, location = "台灣") {
    console.log(`[Maps] 正在查詢景點「${placeName}」的詳細資訊（限制在：${location}）...`);
    if (!GOOGLE_MAPS_API_KEY) {
        console.error("[Maps] Google Maps API Key 未設置");
        return { error: "Google Maps API Key 未設置" };
    }
    try {
        // 1. Find Place ID - 在查詢中直接加入城市限制
        const searchQuery = `${placeName} ${location}`;
        const findPlaceUrl = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
        findPlaceUrl.searchParams.append('input', searchQuery);
        findPlaceUrl.searchParams.append('inputtype', 'textquery');
        findPlaceUrl.searchParams.append('fields', 'place_id,name,rating,user_ratings_total,formatted_address');
        findPlaceUrl.searchParams.append('locationbias', 'region:tw'); // 限制在台灣地區
        findPlaceUrl.searchParams.append('language', 'zh-TW');
        findPlaceUrl.searchParams.append('key', GOOGLE_MAPS_API_KEY);

        const searchResponse = await fetchWithTimeout(findPlaceUrl.toString(), {}, 3000);
        const searchData = await searchResponse.json();

        if (searchData.status !== 'OK' || !searchData.candidates || searchData.candidates.length === 0) {
            console.warn(`[Maps] 找不到景點: ${placeName} (在 ${location})`);
            return { error: `找不到景點: ${placeName}` };
        }
        
        // 驗證返回的地址是否包含目標城市（更靈活的匹配）
        let selectedCandidate = null;
        for (const candidate of searchData.candidates) {
            const address = candidate.formatted_address || '';
            // console.log(`[Maps] 候選地點: ${candidate.name} - ${address}`);
            
            // 檢查地址是否包含目標城市（支援部分匹配）
            // 統一將「臺」轉為「台」以進行比較
            const normalizedAddress = address.replace(/\s+/g, '').replace(/臺/g, '台'); 
            const normalizedLocation = location.replace(/\s+/g, '').replace(/臺/g, '台');
            
            // 檢查是否包含城市名稱的任何形式
            const cityVariants = [
                normalizedLocation,
                normalizedLocation.replace('縣', '').replace('市', ''), // 移除縣市字樣
                normalizedLocation.replace('縣', '市'), // 縣改市
                normalizedLocation.replace('市', '縣'), // 市改縣
            ];
            
            const addressContainsCity = cityVariants.some(variant => 
                normalizedAddress.includes(variant) || 
                address.includes(variant)
            );
            
            if (addressContainsCity || location === "台灣") {
                selectedCandidate = candidate;
                // console.log(`[Maps] ✓ 選擇地點: ${candidate.name} (地址包含 ${location})`);
                break;
            }
        }
        
        // 如果沒有找到符合城市的候選，使用最佳匹配
        if (!selectedCandidate && searchData.candidates.length > 0) {
            selectedCandidate = searchData.candidates[0];
            console.warn(`[Maps] ⚠️ 警告: 找不到位於「${location}」的「${placeName}」，使用最佳搜尋結果: ${selectedCandidate.formatted_address}`);
        }
        
        const placeId = selectedCandidate.place_id;

        // 2. Get Place Details
        const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailsUrl.searchParams.append('place_id', placeId);
        detailsUrl.searchParams.append('fields', 'name,rating,user_ratings_total,formatted_address,address_components,geometry,types,business_status,permanently_closed,opening_hours,photos,formatted_phone_number,website');
        detailsUrl.searchParams.append('language', 'zh-TW');
        detailsUrl.searchParams.append('key', GOOGLE_MAPS_API_KEY);

        const detailsResponse = await fetchWithTimeout(detailsUrl.toString(), {}, 3000);
        const detailsData = await detailsResponse.json();

        if (detailsData.status !== 'OK') {
            console.error(`[Maps] 獲取景點詳情失敗: ${detailsData.status}`);
            return { error: `獲取景點詳情失敗: ${detailsData.status}` };
        }
        const result = detailsData.result;

        // 處理地址：使用 address_components 重組純繁體中文地址
        let chineseAddress = '';
        if (result.address_components && result.address_components.length > 0) {
            const components = result.address_components;
            
            // 提取地址組件（按台灣地址格式排序）
            const country = components.find(c => c.types.includes('country'))?.long_name || '';
            const city = components.find(c => c.types.includes('administrative_area_level_1'))?.long_name || '';
            const district = components.find(c => c.types.includes('administrative_area_level_2'))?.long_name || ''; // 台灣的區是 administrative_area_level_2
            const neighborhood = components.find(c => c.types.includes('neighborhood') || c.types.includes('sublocality_level_2') || c.types.includes('administrative_area_level_3'))?.long_name || '';
            const route = components.find(c => c.types.includes('route'))?.long_name || '';
            const streetNumber = components.find(c => c.types.includes('street_number'))?.long_name || '';
            const postalCode = components.find(c => c.types.includes('postal_code'))?.long_name || '';
            
            // 組合成台灣格式的地址：郵遞區號 + 縣市 + 區 + 街道 + 門牌號
            const addressParts = [
                postalCode,
                city,
                district,
                neighborhood,
                route,
                streetNumber
            ].filter(part => part && part.trim() !== '');
            
            chineseAddress = addressParts.join('');
            
            // console.log(`[Maps] 重組繁體中文地址: ${chineseAddress}`);
        }
        
        // 如果重組失敗，使用 formatted_address 但清理英文部分
        if (!chineseAddress) {
            chineseAddress = result.formatted_address || '';
            // 移除常見的英文地名
            chineseAddress = chineseAddress
                .replace(/\s*,\s*/g, '') // 移除逗號
                .replace(/[A-Za-z\s]+/g, '') // 移除英文字母和空格
                .trim();
            // console.log(`[Maps] 清理後的地址: ${chineseAddress}`);
        }

        // 檢查地點營業狀態
        const businessStatus = result.business_status;
        const permanentlyClosed = result.permanently_closed;

        // 記錄實際收到的狀態供除錯
        // console.log(`[Maps] 地點「${placeName}」的營業狀態: business_status=${businessStatus}, permanently_closed=${permanentlyClosed}`);

        if (businessStatus === 'CLOSED_PERMANENTLY' || permanentlyClosed === true) {
            console.warn(`[Maps] 地點「${placeName}」可能暫停營業或歇業`);
            return { 
                error: `可能暫停營業或歇業`,
                is_closed: true,
                closure_type: 'permanent'
            };
        }

        if (businessStatus === 'CLOSED_TEMPORARILY') {
            console.warn(`[Maps] 地點「${placeName}」暫停營業`);
            return { 
                error: `暫停營業`,
                is_closed: true,
                closure_type: 'temporary'
            };
        }

        // 額外檢查：如果評分很低且評論很少，可能也是問題地點
        const rating = result.rating || 0;
        const userRatingsTotal = result.user_ratings_total || 0;

        if (rating < 2.0 && userRatingsTotal < 5 && userRatingsTotal > 0) {
            console.warn(`[Maps] 地點「${placeName}」評分過低且評論不足，可能已歇業 (評分: ${rating}, 評論數: ${userRatingsTotal})`);
            // 不直接返回錯誤，而是記錄警告，仍然允許使用
        }

        return {
            name: result.name || placeName,
            rating: rating,
            user_ratings_total: userRatingsTotal,
            address: chineseAddress,
            location: result.geometry?.location || {},
            types: result.types || [],
            business_status: businessStatus,
            opening_hours: result.opening_hours?.weekday_text,
            photos: result.photos,
            phone: result.formatted_phone_number,
            website: result.website
        };
    } catch (e) {
        console.error(`[Maps] 獲取景點「${placeName}」詳情時發生錯誤: ${e.message}`);
        return { error: `獲取景點詳情時發生錯誤: ${e.message}` };
    }
}

// --------------------------------------------
// 🚗 交通方式檢測與路線計算
// --------------------------------------------

/**
 * 根據起點和終點智能檢測合適的交通方式
 * @param {string} origin - 起點
 * @param {string} destination - 終點
 * @returns {string} 交通方式: 'driving', 'transit'
 */
function detectTransportationMode(origin, destination) {
    const originLower = origin.toLowerCase();
    const destLower = destination.toLowerCase();

    // 擴展的渡輪關鍵字列表
    const ferryKeywords = [
        '渡輪', '渡船', 'ferry', 'ferry terminal',
        '鼓山', '旗津', '旗津半島', '旗津區', '旗津風景區',
        '高雄港', '高雄港區', '棧貳庫', '棧二庫',
        '馬公', '澎湖', '白沙島', '西嶼'
    ];

    // 檢查是否包含渡輪關鍵字
    const hasFerryOrigin = ferryKeywords.some(keyword => originLower.includes(keyword.toLowerCase()));
    const hasFerryDest = ferryKeywords.some(keyword => destLower.includes(keyword.toLowerCase()));

    // 特殊處理：鼓山到旗津的經典渡輪路線
    const gushanToCijin = (
        (originLower.includes('鼓山') && destLower.includes('旗津')) ||
        (originLower.includes('旗津') && destLower.includes('鼓山'))
    );

    // 澎湖離島間的渡輪
    const penghuFerry = (
        (originLower.includes('馬公') || originLower.includes('澎湖')) &&
        (destLower.includes('白沙') || destLower.includes('西嶼') ||
         destLower.includes('澎湖') && !originLower.includes('馬公'))
    );

    if (hasFerryOrigin || hasFerryDest || gushanToCijin || penghuFerry) {
        return 'transit'; // 使用大眾運輸模式，包含渡輪
    }

    // 檢測機場
    const airportKeywords = ['機場', 'airport', '桃園機場', '松山機場', '高雄機場', '台中機場'];
    if (airportKeywords.some(keyword => originLower.includes(keyword.toLowerCase())) ||
        airportKeywords.some(keyword => destLower.includes(keyword.toLowerCase()))) {
        return 'transit';
    }

    // 檢測火車站/高鐵/捷運
    const stationKeywords = [
        '火車站', '車站', '高鐵', '高鐵站', '捷運', '捷運站',
        '台鐵', '台鐵站', '火車', 'train', 'station'
    ];
    if (stationKeywords.some(keyword => originLower.includes(keyword.toLowerCase())) ||
        stationKeywords.some(keyword => destLower.includes(keyword.toLowerCase()))) {
        return 'transit';
    }

    // 檢測港口/碼頭（需要更精確的匹配，避免誤判"北港"等地名）
    const portKeywords = [
        '高雄港', '基隆港', '台中港', '花蓮港', '蘇澳港', '安平港',
        '港口', '碼頭', '港區', '渡輪碼頭', '客運碼頭',
        'port', 'pier', 'terminal', 'harbor', 'harbour'
    ];
    
    // 排除包含"港"但不是港口的地名
    const notPortKeywords = ['北港', '南港', '西港', '港仔', '港坪', '港墘', '港尾'];
    
    const hasPortOrigin = portKeywords.some(keyword => originLower.includes(keyword.toLowerCase()));
    const hasPortDest = portKeywords.some(keyword => destLower.includes(keyword.toLowerCase()));
    const isNotPortOrigin = notPortKeywords.some(keyword => originLower.includes(keyword.toLowerCase()));
    const isNotPortDest = notPortKeywords.some(keyword => destLower.includes(keyword.toLowerCase()));
    
    if ((hasPortOrigin && !isNotPortOrigin) || (hasPortDest && !isNotPortDest)) {
        return 'transit';
    }

    // 預設使用開車
    return 'driving';
}

/**
 * 異步計算兩地間的距離和時間
 * @param {string} origin - 起點
 * @param {string} destination - 終點
 * @param {string} [mode=null] - 交通方式 (可選，會自動檢測)
 * @returns {Promise<object>} 路線資訊或錯誤物件
 */
export async function calculateRouteDistanceAndTimeSync(origin, destination, mode = null) {
    // 如果沒有指定交通方式，自動檢測
    if (!mode) {
        mode = detectTransportationMode(origin, destination);
    }

    console.log(`[Maps] 正在計算從「${origin}」到「${destination}」的路線 (交通方式: ${mode})...`);
    if (!GOOGLE_MAPS_API_KEY) {
        console.error("[Maps] Google Maps API Key 未設置");
        return { error: "Google Maps API Key 未設置" };
    }
    try {
        const directionsUrl = new URL("https://maps.googleapis.com/maps/api/directions/json");
        directionsUrl.searchParams.append('origin', origin);
        directionsUrl.searchParams.append('destination', destination);
        directionsUrl.searchParams.append('mode', mode);
        directionsUrl.searchParams.append('key', GOOGLE_MAPS_API_KEY);
        directionsUrl.searchParams.append('language', 'zh-TW');
        directionsUrl.searchParams.append('region', 'tw'); // 限制在台灣地區

        const response = await fetchWithTimeout(directionsUrl.toString());
        const data = await response.json();

        // console.log(`[Maps] API 回應狀態: ${data.status}`);
        // console.log(`[Maps] 請求 URL: ${directionsUrl.toString()}`);

        if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
            console.warn(`[Maps] 無法計算路線: ${origin} -> ${destination}`);
            console.warn(`[Maps] API 詳細回應:`, data);
            return { error: `無法計算路線: ${origin} -> ${destination}` };
        }

        const leg = data.routes[0].legs[0];
        // console.log(`[Maps] 計算結果: ${leg.distance.text}, ${leg.duration.text}`);
        // console.log(`[Maps] 起點地址: ${leg.start_address}`);
        // console.log(`[Maps] 終點地址: ${leg.end_address}`);

        return {
            distance_text: leg.distance.text,
            distance_value: leg.distance.value, // 公尺
            duration_text: leg.duration.text,
            duration_value: leg.duration.value, // 秒
            mode: mode
        };
    } catch (e) {
        console.error(`[Maps] 計算路線時發生錯誤: ${e.message}`);
        return { error: `計算路線時發生錯誤: ${e.message}` };
    }
}

// ============================================
// 📊 統計與評分計算功能 (Statistics & Scoring)
// ============================================
// 功能：
// - calculateWilsonScore: 計算威爾遜信心分數（對外導出）
// - parseTimeToMinutes: 時間字串轉分鐘
// - calculatePlayingTime: 計算總遊玩時間（對外導出）
// ============================================

/**
 * 計算威爾遜分數，用於綜合評分和評論數
 * @param {number} rating - 評分 (e.g., 1-5)
 * @param {number} user_ratings_total - 總評論數
 * @returns {number|null} 0-5之間的分數，或在無法計算時返回 null
 */
export function calculateWilsonScore(rating, user_ratings_total) {
    if (user_ratings_total === 0 || typeof rating !== 'number' || rating <= 0) {
        return null;
    }

    const z = 1.96; // 95% confidence
    const p = rating / 5.0;
    const n = user_ratings_total;

    try {
        const numerator = p + (z ** 2 / (2 * n)) - z * Math.sqrt((p * (1 - p) / n) + (z ** 2 / (4 * n ** 2)));
        const denominator = 1 + (z ** 2 / n);

        if (denominator === 0) return null;

        const score0to1 = numerator / denominator;
        return Math.round(score0to1 * 5 * 10) / 10; // Round to one decimal place
    } catch (e) {
        return null;
    }
}

/**
 * 將時間字串轉換為當天從00:00開始的總分鐘數
 * @param {string} timeStr - 時間字串, e.g., "09:00" or "09:00-12:00"
 * @returns {[number, number]} [startMinutes, endMinutes]
 */
export function parseTimeToMinutes(timeStr) {
    try {
        if (typeof timeStr !== 'string') return [0, 60];
        timeStr = timeStr.trim();

        if (timeStr.includes("-")) {
            const [startStr, endStr] = timeStr.split("-", 2).map(s => s.trim());
            const [startHours, startMinutes] = startStr.includes(":") ? startStr.split(":").map(Number) : [0, 0];
            const [endHours, endMinutes] = endStr.includes(":") ? endStr.split(":").map(Number) : [startHours, startMinutes + 60];
            return [startHours * 60 + startMinutes, endHours * 60 + endMinutes];
        } else if (timeStr.includes(":")) {
            const [hours, minutes] = timeStr.split(":").map(Number);
            const startTotal = hours * 60 + minutes;
            return [startTotal, startTotal + 60]; // 假設持續1小時
        }
        return [0, 60];
    } catch (e) {
        return [0, 60];
    }
}

/**
 * 計算總遊玩時間（分鐘）
 * @param {Array<object>} sections - 行程活動列表
 * @returns {number} 總分鐘數
 */
export function calculatePlayingTime(sections) {
    if (!sections || !Array.isArray(sections)) return 0;

    const sectionsByDay = sections.reduce((acc, section) => {
        if (typeof section === 'object' && section.day) {
            acc[section.day] = acc[section.day] || [];
            acc[section.day].push(section);
        }
        return acc;
    }, {});

    let totalPlayingTime = 0;
    for (const day in sectionsByDay) {
        const daySections = sectionsByDay[day];
        if (daySections.length === 0) continue;

        const times = daySections.map(s => s.time && parseTimeToMinutes(s.time)).filter(Boolean);
        if (times.length > 0) {
            const dayStart = Math.min(...times.map(t => t[0]));
            const dayEnd = Math.max(...times.map(t => t[1]));
            totalPlayingTime += Math.max(0, dayEnd - dayStart);
        }
    }
    return totalPlayingTime;
}

// ============================================
// 📅 日期時間處理功能 (Date & Time Functions)
// ============================================
// 功能：
// - calculateTripDates: 根據查詢計算旅遊日期（對外導出）
// ============================================

/**
 * 根據用戶查詢和天數計算具體的旅遊日期
 * @param {string} query - 用戶的查詢字串
 * @param {number} days - 旅遊天數
 * @returns {string[]} 日期字串陣列 (YYYY-MM-DD)
 */
export function calculateTripDates(query, days) {
    const dates = [];
    let startDate = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const queryLower = query.toLowerCase();

    if (queryLower.includes("下週") || queryLower.includes("next week")) {
        const daysUntilNextWeek = (7 - startDate.getDay()) % 7 + 1;
        startDate.setDate(startDate.getDate() + daysUntilNextWeek);
    } else if (queryLower.includes("下個月") || queryLower.includes("next month")) {
        startDate.setMonth(startDate.getMonth() + 1, 1);
    } else if (queryLower.includes("週末") || queryLower.includes("weekend")) {
        const daysUntilWeekend = (6 - startDate.getDay() + 7) % 7;
        startDate.setDate(startDate.getDate() + daysUntilWeekend);
    } else if (queryLower.includes("明天") || queryLower.includes("tomorrow")) {
        startDate.setDate(startDate.getDate() + 1);
    } else if (queryLower.includes("後天") || queryLower.includes("day after tomorrow")) {
        startDate.setDate(startDate.getDate() + 2);
    }

    // 檢查是否有具體日期
    const dateMatch = query.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/) || query.match(/(\d{1,2})[/-](\d{1,2})/) || query.match(/(\d{1,2})月(\d{1,2})日/);
    if (dateMatch) {
        let year, month, day;
        if (dateMatch.length === 4) { // YYYY-MM-DD
            year = parseInt(dateMatch[1], 10);
            month = parseInt(dateMatch[2], 10);
            day = parseInt(dateMatch[3], 10);
        } else { // MM-DD or MM月DD日
            year = today.getFullYear();
            month = parseInt(dateMatch[1], 10);
            day = parseInt(dateMatch[2], 10);
        }
        
        // 使用本地日期字符串創建日期，避免時區問題
        let parsedDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`);
        if (parsedDate < today) {
            parsedDate.setFullYear(parsedDate.getFullYear() + 1);
        }
        startDate = parsedDate;
    }

    for (let i = 0; i < days; i++) {
        const targetDate = new Date(startDate);
        targetDate.setDate(targetDate.getDate() + i);
        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
    }

    return dates;
}

// ============================================
// 🏷️ 輔助工具函數 (Utility Functions)
// ============================================
// 功能：
// - isLocationSpecific: 檢查地點名稱是否具體（對外導出）
// ============================================

/**
 * 檢查地點名稱是否足夠具體
 * @param {string} location - 地點名稱
 * @returns {boolean}
 */
export function isLocationSpecific(location) {
    if (!location || typeof location !== 'string') return false;
    location = location.trim();

    const genericLocations = [
        "台灣", "台北", "台中", "台南", "高雄", "新北", "桃園", "新竹",
        "苗栗", "彰化", "南投", "雲林", "嘉義", "屏東", "宜蘭", "花蓮",
        "台東", "澎湖", "金門", "連江", "基隆", "台灣各地", "全台",
        "北部", "中部", "南部", "東部", "離島", "城市", "鄉村",
        "山區", "海邊", "郊區", "市區", "鄉鎮", "村莊"
    ];

    if (genericLocations.includes(location)) return false;
    if (location.length < 2) return false;

    const fuzzyWords = ["附近", "周邊", "一帶", "地區", "區域", "地方", "景點"];
    if (fuzzyWords.some(word => location.includes(word))) return false;

    return true;
}

// ============================================
// 🗺️ 行程豐富化功能 (Itinerary Enrichment)
// ============================================
// 功能：
// - enrichWithMapsData: 為行程添加地圖資訊和交通時間（對外導出）
// ============================================

/**
 * 為行程數據添加交通時間 (平行處理優化版)
 * @param {object} tripData - 行程數據 (需包含 maps_data)
 * @returns {Promise<object>} 添加交通時間後的行程數據
 */
export async function addTravelTimes(tripData) {
    if (!tripData.sections) return tripData;
    
    const sections = tripData.sections;
    const routeRequests = [];

    // 1. 收集所有需要計算的路線
    for (let i = 0; i < sections.length - 1; i++) {
        const currentSection = sections[i];
        const nextSection = sections[i + 1];

        if (currentSection.day === nextSection.day && currentSection.location && nextSection.location) {
            const originAddress = currentSection.maps_data?.address || currentSection.location;
            const destAddress = nextSection.maps_data?.address || nextSection.location;
            const fromName = currentSection.maps_data?.google_maps_name || currentSection.maps_data?.address || currentSection.location;
            const toName = nextSection.maps_data?.google_maps_name || nextSection.maps_data?.address || nextSection.location;

            routeRequests.push({
                index: i,
                origin: originAddress,
                destination: destAddress,
                fromName,
                toName,
                day: currentSection.day,
                currentLoc: currentSection.location,
                nextLoc: nextSection.location
            });
        }
    }

    // 2. 平行執行所有路線計算
    console.log(`[Trip] 平行計算 ${routeRequests.length} 條路線的交通時間...`);
    const routeResults = await Promise.all(
        routeRequests.map(async (req) => {
            try {
                const routeData = await calculateRouteDistanceAndTimeSync(req.origin, req.destination);
                return { ...req, routeData };
            } catch (error) {
                console.error(`[Trip] 計算交通時間時發生錯誤: ${error.message}`);
                return { ...req, error };
            }
        })
    );

    // 3. 重組行程區段
    const sectionsWithTravel = [];
    for (let i = 0; i < sections.length; i++) {
        sectionsWithTravel.push(sections[i]);
        
        // 檢查此索引是否有對應的路線結果
        const result = routeResults.find(r => r.index === i);
        if (result) {
            let travelSection;
            const { routeData, fromName, toName, day, currentLoc, nextLoc } = result;

            if (routeData && !routeData.error && !result.error) {
                travelSection = {
                    time: `交通時間: 約 ${Math.round(routeData.duration_value / 60)} 分鐘`,
                    location: `從${fromName}到${toName}的交通`,
                    details: [`${routeData.mode === 'driving' ? '開車' : routeData.mode === 'transit' ? '大眾運輸' : '步行'}約 ${routeData.distance_text}`],
                    day: day,
                    is_travel_time: true,
                    travel_info: {
                        from: fromName,
                        to: toName,
                        distance: routeData.distance_text || '',
                        duration: routeData.duration_text || '',
                        duration_value: routeData.duration_value || 0,
                        mode: routeData.mode || 'driving'
                    }
                };
            } else {
                // 錯誤處理或無法計算時的預設值
                const errMessage = routeData?.error || result.error?.message || '未知錯誤';
                console.warn(`[Trip] 無法計算從 ${currentLoc} 到 ${nextLoc} 的交通時間: ${errMessage}`);
                
                travelSection = {
                    time: `交通時間: 約 15 分鐘`,
                    location: `從${currentLoc}到${nextLoc}的交通`,
                    details: [`預估交通時間`],
                    day: day,
                    is_travel_time: true,
                    travel_info: {
                        from: currentLoc,
                        to: nextLoc,
                        distance: '',
                        duration: '約 15 分鐘',
                        duration_value: 900,
                        mode: 'driving'
                    }
                };
            }
            sectionsWithTravel.push(travelSection);
        }
    }

    tripData.sections = sectionsWithTravel;
    return tripData;
}

/**
 * 為行程數據添加 Google Maps 資訊和交通時間
 * @param {object} tripData - 原始行程數據
 * @param {string} cityLocation - 城市位置偏好
 * @param {object} options - 選項 { insertTravelTimes: boolean }
 * @returns {Promise<object>} 豐富化後的行程數據
 */
export async function enrichWithMapsData(tripData, cityLocation, options = { insertTravelTimes: true }) {
    if (!tripData.sections) return tripData;

    const places = [...new Set(tripData.sections.map(s => s.location).filter(Boolean))];

    const placesData = {};
    const placePromises = places.map(placeName =>
        getPlaceDetailsSync(placeName, cityLocation).then(mapsData => {
            if (!mapsData.error) {
                placesData[placeName] = mapsData;
            } else if (mapsData.error && (mapsData.error.includes('歇業') || mapsData.error.includes('closed'))) {
                // 對於歇業地點，記錄警告但不添加到placesData中
                console.warn(`[Trip] 地點「${placeName}」可能已歇業: ${mapsData.error}`);
                // 可以選擇添加一個標記，表示這個地點有問題
                placesData[placeName] = {
                    error: mapsData.error,
                    is_closed: true
                };
            }
        })
    );
    await Promise.all(placePromises);

    // 首先為每個項目添加地圖數據
    const sectionsWithMaps = tripData.sections.map(section => {
        const enrichedSection = { ...section };
        const placeName = section.location;
        if (placeName && placesData[placeName]) {
            const mapsInfo = placesData[placeName];

            // 檢查是否為歇業地點
            if (mapsInfo.is_closed) {
                enrichedSection.warning = `注意：「${placeName}」${mapsInfo.error}`;
                enrichedSection.closure_type = mapsInfo.closure_type; // 'permanent' 或 'temporary'
                enrichedSection.maps_data = null; // 不設置maps_data，因為地點已歇業
            } else {
                enrichedSection.maps_data = {
                    rating: mapsInfo.rating || 0,
                    user_ratings_total: mapsInfo.user_ratings_total || 0,
                    address: mapsInfo.address || '',
                    google_maps_name: mapsInfo.name || placeName,
                    wilson_score: calculateWilsonScore(mapsInfo.rating, mapsInfo.user_ratings_total),
                    opening_hours: mapsInfo.opening_hours,
                    phone: mapsInfo.phone,
                    website: mapsInfo.website,
                    photo_url: mapsInfo.photos && mapsInfo.photos.length > 0 
                        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${mapsInfo.photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`
                        : null
                };

                // 加入座標資訊（地圖顯示需要）
                if (mapsInfo.location) {
                    enrichedSection.coordinates = {
                        lat: mapsInfo.location.lat,
                        lng: mapsInfo.location.lng
                    };
                }
            }
        }
        return enrichedSection;
    });

    tripData.sections = sectionsWithMaps;

    if (options.insertTravelTimes) {
        return await addTravelTimes(tripData);
    }

    return tripData;
}

/**
 * 僅獲取地點座標（輕量級查詢）
 * @param {string} placeName - 景點名稱
 * @param {string} [location="台灣"] - 地點偏好
 * @returns {Promise<object>} 座標物件 { lat, lng } 或 null
 */
export async function getPlaceCoordinatesSync(placeName, location = "台灣") {
    if (!GOOGLE_MAPS_API_KEY) return null;
    
    try {
        const searchQuery = `${placeName} ${location}`;
        const findPlaceUrl = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
        findPlaceUrl.searchParams.append('input', searchQuery);
        findPlaceUrl.searchParams.append('inputtype', 'textquery');
        findPlaceUrl.searchParams.append('fields', 'geometry,name'); // 只請求 geometry 和 name
        findPlaceUrl.searchParams.append('locationbias', 'region:tw');
        findPlaceUrl.searchParams.append('language', 'zh-TW');
        findPlaceUrl.searchParams.append('key', GOOGLE_MAPS_API_KEY);

        const response = await fetchWithTimeout(findPlaceUrl.toString(), {}, 2000); // 短超時
        const data = await response.json();

        if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            if (candidate.geometry && candidate.geometry.location) {
                return candidate.geometry.location;
            }
        }
        return null;
    } catch (e) {
        console.warn(`[Maps] 獲取座標失敗 (${placeName}): ${e.message}`);
        return null;
    }
}

/**
 * 為行程中缺少座標的地點補充座標（用於後端優化）
 * @param {object} tripData - 行程數據
 * @param {string} cityLocation - 城市
 * @returns {Promise<object>} 更新後的行程數據
 */
export async function enrichWithCoordinates(tripData, cityLocation) {
    if (!tripData.sections) return tripData;

    // 找出缺少座標的地點
    const missingCoordsPlaces = tripData.sections
        .filter(s => (!s.lat || !s.lng) && (!s.coordinates || !s.coordinates.lat))
        .map(s => s.location)
        .filter((v, i, a) => a.indexOf(v) === i); // 去重

    if (missingCoordsPlaces.length === 0) return tripData;

    console.log(`[Maps] 正在為 ${missingCoordsPlaces.length} 個地點補充座標...`);

    const coordsMap = {};
    // 平行請求，但限制並發數以免觸發 API 限制（這裡簡單全並發，因為數量通常不多）
    const promises = missingCoordsPlaces.map(place => 
        getPlaceCoordinatesSync(place, cityLocation).then(coords => {
            if (coords) coordsMap[place] = coords;
        })
    );

    await Promise.all(promises);

    // 更新行程
    tripData.sections.forEach(section => {
        if ((!section.lat || !section.lng) && coordsMap[section.location]) {
            const coords = coordsMap[section.location];
            section.lat = coords.lat;
            section.lng = coords.lng;
            // 確保 coordinates 結構也存在（前端可能用到）
            if (!section.coordinates) {
                section.coordinates = { lat: coords.lat, lng: coords.lng };
            }
        }
    });

    return tripData;
}

