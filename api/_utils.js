// api/_utils.js

// API Keys - 從環境變數讀取
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const CWA_AUTH = process.env.CWA_API_KEY || 'CWA-F3FCE1AF-CFF8-4531-86AD-379B18FE38A2';

// 城市名稱到天氣資料集 ID 的映射 (一般天氣預報-今明 36 小時天氣預報)
const CITY_MAPPING_36HR = {
    "台北": "F-D0047-061", "台中": "F-D0047-071", "台南": "F-D0047-075",
    "高雄": "F-D0047-063", "新北": "F-D0047-069", "桃園": "F-D0047-007",
    "新竹": "F-D0047-053", "苗栗": "F-D0047-035", "彰化": "F-D0047-017",
    "南投": "F-D0047-047", "雲林": "F-D0047-081", "嘉義": "F-D0047-011",
    "屏東": "F-D0047-029", "宜蘭": "F-D0047-003", "花蓮": "F-D0047-021",
    "台東": "F-D0047-025", "澎湖": "F-D0047-039", "金門": "F-D0047-033",
    "連江": "F-D0047-073", "基隆": "F-D0047-051",
};

// 城市名稱到天氣資料集 ID 的映射 (一般天氣預報-未來一週天氣預報)
const CITY_MAPPING_WEEK = {
    "台北": "F-D0047-063", "台中": "F-D0047-073", "台南": "F-D0047-077",
    "高雄": "F-D0047-065", "新北": "F-D0047-071", "桃園": "F-D0047-009",
    "新竹": "F-D0047-055", "苗栗": "F-D0047-037", "彰化": "F-D0047-019",
    "南投": "F-D0047-049", "雲林": "F-D0047-083", "嘉義": "F-D0047-013",
    "屏東": "F-D0047-031", "宜蘭": "F-D0047-005", "花蓮": "F-D0047-023",
    "台東": "F-D0047-027", "澎湖": "F-D0047-041", "金門": "F-D0047-035",
    "連江": "F-D0047-075", "基隆": "F-D0047-053",
};

/**
 * 異步獲取指定城市和日期的天氣資訊（使用一週預報 API）
 * @param {string} cityName - 城市中文名
 * @param {string} [date] - 日期字串 (YYYY-MM-DD)，可選
 * @returns {Promise<object>} 天氣資訊物件或錯誤物件
 */
async function getWeatherSync(cityName, date) {
    console.log(`[Weather] 正在為城市「${cityName}」的日期「${date}」獲取天氣...`);
    try {
        // 優先使用一週預報 API，如果失敗則使用 36 小時預報 API
        const datasetId = CITY_MAPPING_WEEK[cityName] || CITY_MAPPING_36HR[cityName] || "F-D0047-065";
        const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${datasetId}?Authorization=${CWA_AUTH}&format=JSON`;

        const response = await fetch(url, { timeout: 10000 });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.success !== 'true') {
            console.error(`[Weather] API 回應失敗:`, data);
            return { error: "獲取天氣資料失敗" };
        }

        if (date) {
            return getWeatherForDateFromForecast(data, date);
        }
        // 如果沒有指定日期，此處邏輯暫不實現，因為目前前端總是提供日期
        return { error: "需要提供具體日期" };

    } catch (e) {
        console.error(`獲取天氣資訊時發生錯誤: ${e.message}`);
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
        const targetDate = new Date(dateStr + 'T00:00:00');
        const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

        const locationData = data?.records?.Locations?.[0]?.Location?.[0];
        if (!locationData) {
            return { error: "無天氣資料" };
        }

        const weatherElements = locationData.WeatherElement;
        const dateWeatherData = [];

        for (const element of weatherElements) {
            for (const slot of element.Time) {
                // 一週預報 API 使用 StartTime 和 EndTime
                const startTime = slot.StartTime || slot.DataTime;
                if (!startTime) continue;
                
                const slotDate = new Date(startTime);
                const slotDateStr = slotDate.toISOString().split('T')[0];
                
                if (slotDateStr === targetDateStr) {
                    const valueObj = slot.ElementValue?.[0] || slot.Parameter?.[0];
                    if (!valueObj) continue;
                    
                    let value;
                    // 一週預報 API 的欄位結構
                    if (element.ElementName === 'Wx') {
                        // 天氣現象
                        value = valueObj.parameterName || valueObj.ParameterName;
                    } else if (element.ElementName === 'AT') {
                        // 體感溫度
                        value = valueObj.parameterName || valueObj.ParameterName;
                    } else if (element.ElementName === 'T') {
                        // 溫度
                        value = valueObj.parameterName || valueObj.ParameterName;
                    } else if (element.ElementName === 'RH') {
                        // 相對濕度
                        value = valueObj.parameterName || valueObj.ParameterName;
                    } else if (element.ElementName === 'CI') {
                        // 舒適度
                        value = valueObj.parameterName || valueObj.ParameterName;
                    } else if (element.ElementName === 'PoP12h' || element.ElementName === 'PoP6h') {
                        // 降雨機率
                        value = valueObj.parameterName || valueObj.ParameterName;
                    } else if (element.ElementName === 'MinT') {
                        // 最低溫度
                        value = valueObj.parameterName || valueObj.ParameterName;
                    } else if (element.ElementName === 'MaxT') {
                        // 最高溫度
                        value = valueObj.parameterName || valueObj.ParameterName;
                    } else if (element.ElementName === 'UVI') {
                        // 紫外線指數
                        value = valueObj.parameterName || valueObj.ParameterName;
                    } else if (element.ElementName === 'WeatherDescription') {
                        // 天氣預報綜合描述
                        value = valueObj.parameterName || valueObj.ParameterName;
                    } else {
                        value = valueObj.parameterName || valueObj.ParameterName || valueObj.value;
                    }

                    if (value && value !== ' ') {
                        dateWeatherData.push({
                            element: element.ElementName,
                            value: value,
                        });
                    }
                }
            }
        }

        if (dateWeatherData.length === 0) {
            console.log(`[Weather] 找不到 ${dateStr} 的天氣預報資料`);
            return { error: `找不到 ${dateStr} 的天氣預報資料` };
        }

        // 統計數據
        const aggregate = (elementNames) => {
            const values = dateWeatherData
                .filter(item => elementNames.includes(item.element) && item.value && item.value !== '-' && item.value !== ' ')
                .map(item => {
                    const num = parseFloat(item.value);
                    return isNaN(num) ? null : num;
                })
                .filter(v => v !== null);
            return values.length > 0 ? values : null;
        };
        
        // 提取天氣現象
        const conditions = dateWeatherData.filter(item => item.element === 'Wx').map(item => item.value);
        const mainCondition = conditions.length > 0 ? conditions[0] : '無資料';

        // 提取溫度數據
        const temps = aggregate(['T', 'AT']);
        const maxTemps = aggregate(['MaxT']);
        const minTemps = aggregate(['MinT']);
        const rainProbs = aggregate(['PoP12h', 'PoP6h']);

        const avgTemp = temps ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : '無資料';
        const maxTemp = maxTemps ? Math.round(Math.max(...maxTemps)) : '無資料';
        const minTemp = minTemps ? Math.round(Math.min(...minTemps)) : '無資料';
        const rainChance = rainProbs ? Math.round(rainProbs.reduce((a, b) => a + b, 0) / rainProbs.length) : '無資料';

        const uviValues = aggregate(['UVI']);
        const uvi = uviValues ? Math.max(...uviValues) : '無資料';

        const descriptions = dateWeatherData.filter(item => item.element === 'WeatherDescription').map(item => item.value);
        const weatherDescription = descriptions.length > 0 ? descriptions[0] : '無特別天氣提醒。';

        let icon = '☀️';
        if (mainCondition.includes('晴')) icon = '☀️';
        else if (mainCondition.includes('雨')) icon = '🌧️';
        else if (mainCondition.includes('雲') || mainCondition.includes('陰')) icon = '☁️';
        else if (mainCondition.includes('雷')) icon = '⛈️';
        else if (mainCondition.includes('雪')) icon = '❄️';

        console.log(`[Weather] ${dateStr} 天氣資料:`, {
            condition: mainCondition,
            temp: avgTemp,
            min_temp: minTemp,
            max_temp: maxTemp,
            rain_chance: rainChance
        });

        return {
            condition: mainCondition,
            temp: avgTemp,
            min_temp: minTemp,
            max_temp: maxTemp,
            rain_chance: rainChance,
            uvi: uvi,
            description: weatherDescription,
            icon: icon,
            date: dateStr
        };

    } catch (e) {
        console.error(`[Weather] 解析天氣預報失敗:`, e);
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
        return {};
    }
    const weatherPromises = dates.map(date => getWeatherSync(cityName, date));
    const results = await Promise.all(weatherPromises);
    
    const weatherData = {};
    dates.forEach((date, index) => {
        // 只添加有有效數據的結果，忽略錯誤
        if (results[index] && !results[index].error) {
            weatherData[date] = results[index];
        }
        // 如果沒有數據，weatherData[date] 會是 undefined，這是正常的
    });
    return weatherData;
}

/**
 * 異步獲取 Google Maps 景點詳情
 * @param {string} placeName - 景點名稱
 * @param {string} [location="台灣"] - 地點偏好
 * @returns {Promise<object>} 景點詳情或錯誤物件
 */
export async function getPlaceDetailsSync(placeName, location = "台灣") {
    console.log(`[Maps] 正在查詢景點「${placeName}」的詳細資訊...`);
    if (!GOOGLE_MAPS_API_KEY) {
        console.error("[Maps] Google Maps API Key 未設置");
        return { error: "Google Maps API Key 未設置" };
    }
    try {
        // 1. Find Place ID
        const findPlaceUrl = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
        findPlaceUrl.searchParams.append('input', placeName);
        findPlaceUrl.searchParams.append('inputtype', 'textquery');
        findPlaceUrl.searchParams.append('fields', 'place_id,name,rating,user_ratings_total,formatted_address');
        findPlaceUrl.searchParams.append('locationbias', `region:${location}`);
        findPlaceUrl.searchParams.append('language', 'zh-TW');
        findPlaceUrl.searchParams.append('key', GOOGLE_MAPS_API_KEY);

        const searchResponse = await fetch(findPlaceUrl.toString());
        const searchData = await searchResponse.json();

        if (searchData.status !== 'OK' || !searchData.candidates || searchData.candidates.length === 0) {
            console.warn(`[Maps] 找不到景點: ${placeName}`);
            return { error: `找不到景點: ${placeName}` };
        }
        const placeId = searchData.candidates[0].place_id;

        // 2. Get Place Details
        const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailsUrl.searchParams.append('place_id', placeId);
        detailsUrl.searchParams.append('fields', 'name,rating,user_ratings_total,formatted_address,geometry,types,business_status,permanently_closed');
        detailsUrl.searchParams.append('language', 'zh-TW');
        detailsUrl.searchParams.append('key', GOOGLE_MAPS_API_KEY);

        const detailsResponse = await fetch(detailsUrl.toString());
        const detailsData = await detailsResponse.json();

        if (detailsData.status !== 'OK') {
            console.error(`[Maps] 獲取景點詳情失敗: ${detailsData.status}`);
            return { error: `獲取景點詳情失敗: ${detailsData.status}` };
        }
        const result = detailsData.result;

        // 檢查地點營業狀態
        const businessStatus = result.business_status;
        const permanentlyClosed = result.permanently_closed;

        if (businessStatus === 'CLOSED_PERMANENTLY' || permanentlyClosed === true) {
            console.warn(`[Maps] 地點「${placeName}」已永久歇業，跳過此地點`);
            return { error: `地點「${placeName}」已永久歇業` };
        }

        if (businessStatus === 'CLOSED_TEMPORARILY') {
            console.warn(`[Maps] 地點「${placeName}」暫時歇業，跳過此地點`);
            return { error: `地點「${placeName}」暫時歇業` };
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
            address: result.formatted_address || '',
            location: result.geometry?.location || {},
            types: result.types || [],
            business_status: businessStatus
        };
    } catch (e) {
        console.error(`[Maps] 獲取景點「${placeName}」詳情時發生錯誤: ${e.message}`);
        return { error: `獲取景點詳情時發生錯誤: ${e.message}` };
    }
}

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

    // 檢測港口/碼頭
    const portKeywords = ['港', '港區', '碼頭', '港口', 'pier', 'terminal'];
    if (portKeywords.some(keyword => originLower.includes(keyword.toLowerCase())) ||
        portKeywords.some(keyword => destLower.includes(keyword.toLowerCase()))) {
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

        const response = await fetch(directionsUrl.toString());
        const data = await response.json();

        console.log(`[Maps] API 回應狀態: ${data.status}`);
        console.log(`[Maps] 請求 URL: ${directionsUrl.toString()}`);

        if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
            console.warn(`[Maps] 無法計算路線: ${origin} -> ${destination}`);
            console.warn(`[Maps] API 詳細回應:`, data);
            return { error: `無法計算路線: ${origin} -> ${destination}` };
        }

        const leg = data.routes[0].legs[0];
        console.log(`[Maps] 計算結果: ${leg.distance.text}, ${leg.duration.text}`);
        console.log(`[Maps] 起點地址: ${leg.start_address}`);
        console.log(`[Maps] 終點地址: ${leg.end_address}`);

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

/**
 * 從城市名稱提取對應的英文城市名稱
 * @param {string} cityName - 城市中文名
 * @returns {string} 城市英文名
 */
export function extractCityName(cityName) {
    const cityMapping = {
        "台北": "Taipei", "新北": "New Taipei", "桃園": "Taoyuan",
        "台中": "Taichung", "台南": "Tainan", "高雄": "Kaohsiung",
        "基隆": "Keelung", "新竹": "Hsinchu", "苗栗": "Miaoli",
        "彰化": "Changhua", "南投": "Nantou", "雲林": "Yunlin",
        "嘉義": "Chiayi", "屏東": "Pingtung", "宜蘭": "Yilan",
        "花蓮": "Hualien", "台東": "Taitung", "澎湖": "Penghu",
        "金門": "Kinmen", "連江": "Lienchiang"
    };
    for (const key in cityMapping) {
        if (cityName.includes(key)) {
            return cityMapping[key];
        }
    }
    return "Taipei"; // Default
}
