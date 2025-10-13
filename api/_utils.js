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
 * 異步獲取指定城市的完整一週天氣預報數據
 * @param {string} cityName - 城市中文名
 * @returns {Promise<object>} 完整的API回應數據或錯誤物件
 */
async function getWeeklyForecastData(cityName) {
    console.log(`[Weather] 正在為城市「${cityName}」獲取完整一週天氣預報...`);
    try {
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

        return data;

    } catch (e) {
        console.error(`獲取一週天氣預報時發生錯誤: ${e.message}`);
        return { error: `獲取天氣資訊失敗: ${e.message}` };
    }
}

/**
 * 從過濾後的天氣數據中提取指定日期的天氣資訊
 * @param {object} filteredSlots - 按日期分組的時間槽數據
 * @param {string} dateStr - 目標日期字串 (YYYY-MM-DD)
 * @returns {object} 整理後的單日天氣資訊
 */
function extractWeatherFromFilteredSlots(filteredSlots, dateStr) {
    try {
        if (!filteredSlots[dateStr]) {
            return { error: `無 ${dateStr} 的天氣資料` };
        }

        const dateSlots = filteredSlots[dateStr];
        const weatherData = {};

        // 處理每個天氣元素
        for (const [elementName, slots] of Object.entries(dateSlots)) {
            if (slots.length === 0) continue;

            // 取第一個slot的值（因為同一日期可能有多個時間槽）
            const slot = slots[0];
            const valueObj = slot.ElementValue?.[0] || slot.Parameter?.[0];
            if (!valueObj) continue;

            let value;
            // 一週預報 API 的欄位結構
            if (elementName === 'Wx') {
                // 天氣現象
                value = valueObj.parameterName || valueObj.ParameterName;
            } else if (elementName === 'AT') {
                // 體感溫度
                value = valueObj.parameterName || valueObj.ParameterName;
            } else if (elementName === 'T') {
                // 溫度
                value = valueObj.parameterName || valueObj.ParameterName;
            } else if (elementName === 'RH') {
                // 相對濕度
                value = valueObj.parameterName || valueObj.ParameterName;
            } else if (elementName === 'CI') {
                // 舒適度
                value = valueObj.parameterName || valueObj.ParameterName;
            } else if (elementName === 'PoP12h' || elementName === 'PoP6h') {
                // 降雨機率
                value = valueObj.parameterName || valueObj.ParameterName;
            } else if (elementName === 'MinT') {
                // 最低溫度
                value = valueObj.parameterName || valueObj.ParameterName;
            } else if (elementName === 'MaxT') {
                // 最高溫度
                value = valueObj.parameterName || valueObj.ParameterName;
            } else if (elementName === 'UVI') {
                // 紫外線指數
                value = valueObj.parameterName || valueObj.ParameterName;
            } else if (elementName === 'WeatherDescription') {
                // 天氣預報綜合描述
                value = valueObj.parameterName || valueObj.ParameterName;
            } else {
                value = valueObj.parameterName || valueObj.ParameterName || valueObj.value;
            }

            if (value && value !== ' ') {
                weatherData[elementName] = value;
            }
        }

        // 如果沒有任何數據，返回錯誤
        if (Object.keys(weatherData).length === 0) {
            return { error: `無 ${dateStr} 的有效天氣資料` };
        }

        return {
            ...weatherData,
            date: dateStr
        };

    } catch (e) {
        console.error(`[Weather] 解析過濾後的天氣數據失敗:`, e);
        return { error: `解析天氣預報失敗: ${e.message}` };
    }
}

/**
 * 獲取多日期的天氣資訊
 * @param {string} cityName - 城市中文名
 * @param {string[]} dates - 日期字串陣列 (YYYY-MM-DD)
 * @returns {Promise<object>} 一個以日期為鍵，天氣資訊為值的物件
 */
module.exports = {
    getMultiDayWeatherSync,
    getPlaceDetailsSync,
    calculateRouteDistanceAndTimeSync,
    calculateTripDates,
    isLocationSpecific,
    extractCityName,
    calculatePlayingTime,
    calculateWilsonScore,
    parseTimeToMinutes
};