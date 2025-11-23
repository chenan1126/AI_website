// api/ask.js
// import dotenv from 'dotenv';
// dotenv.config();

import {
    getMultiDayWeatherSync,
    getPlaceDetailsSync,
    calculateRouteDistanceAndTimeSync,
    calculateTripDates,
    calculatePlayingTime,
    calculateWilsonScore,
    enrichWithMapsData,
    enrichWithCoordinates,
    addTravelTimes
} from './_utils.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { retrieveRelevantData, formatRetrievalForPrompt } from './utils/ragRetriever.js';
import { optimizeDayWithLunch } from './utils/geoOptimizer.js';

// 配置 Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- Helper Functions from backend/app.py logic ---

/**
 * 使用 Gemini API 解析用戶的自然語言輸入，提取地點、縣市和天數。
 * @param {string} query - 用戶的原始查詢
 * @returns {Promise<object>} - 解析後的物件 { location, city, days }
 */
async function parseQueryWithGemini(query, res) {
    if (!GEMINI_API_KEY) {
        console.error("缺少 Gemini API Key");
        return { location: "台灣", city: "台灣", days: "一日遊", error: "錯誤: 未設置 Gemini API Key" };
    }
    try {
        // console.log(`開始使用 Gemini 解析用戶查詢: ${query}`);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `你是一個專門解析旅遊需求的 AI。請從以下句子中提取『主要遊玩地點』、『該地點所屬的台灣縣市』和『旅遊天數』。

句子: "${query}"

你的回應必須是可直接解析的純 JSON 格式，不包含任何其他說明文字、markdown 標籤或程式碼區塊。
絕對不要使用 \`\`\`json 或任何類似的標籤。
JSON 格式: {"location": "地點", "city": "縣市", "days": "天數"}

範例：
- 輸入: "想去阿里山看日出"
- 輸出: {"location": "阿里山", "city": "嘉義縣", "days": "一日遊"}
- 輸入: "明天去高雄玩兩天"
- 輸出: {"location": "高雄", "city": "高雄市", "days": "兩天"}
- 輸入: "週末去台中"
- 輸出: {"location": "台中", "city": "台中市", "days": "兩天"}
- 輸入: "去嘉義玩"
- 輸出: {"location": "嘉義市", "city": "嘉義市", "days": "一日遊"}
- 輸入: "去台北玩，從台北車站出發"
- 輸出: {"location": "台北", "city": "台北市", "days": "一日遊"}

規則：
1. 'location' 必須是台灣的真實地點。
2. 'city' 必須是 'location' 所屬的台灣縣市。如果無法判斷，請將 'city' 設為與 'location' 相同。
3. 'days' 如果沒有明確天數，請根據上下文推斷（例如「週末」是兩天），若無法推斷則預設為「一日遊」。
4. **特別規則**：如果用戶只提到「嘉義」而沒有明確說「嘉義縣」或「阿里山」等山區地名，請務必將 'location' 和 'city' 都設為「嘉義市」。這是為了區分市區旅遊和山區旅遊。
5. **排除交通節點**：如果用戶提到「車站」、「高鐵」、「機場」等作為起點、終點或集合點，請不要將其作為 'location'，除非它是唯一的目的地。請提取主要的遊玩城市或區域。`;

        const result = await model.generateContent(
            prompt,
            { responseMimeType: "application/json" }
        );
        const response = result.response;
        let rawText = response.text();
        
        // 將原始回覆傳送到前端
        if (res) {
            sendSseEvent(res, 'raw_parsing_response', { raw: rawText });
        }

        // 清理潛在的 Markdown 標籤
        rawText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

        const parsedData = JSON.parse(rawText);

        if (!parsedData.location || !parsedData.days || !parsedData.city) {
             console.error(`Gemini 解析結果缺少必要欄位: ${JSON.stringify(parsedData)}`);
             const location = parsedData.location || "台灣";
             return { location, city: location, days: parsedData.days || "一日遊", error: "解析不完整" };
        }
        // console.log(`Gemini 解析完成:`, parsedData);
        return parsedData;

    } catch (e) {
        console.error(`使用 Gemini 解析用戶查詢時出錯: ${e}`);
        // 降級處理：如果解析失敗，至少返回一個預設值
        return { location: "台灣", city: "台灣", days: "一日遊", error: `解析查詢時出錯: ${e.message}` };
    }
}

// Helper to send SSE events
function sendSseEvent(res, eventType, data) {
    try {
        // 確保 JSON.stringify 正確處理所有字符
        const jsonData = JSON.stringify(data);
        
        // SSE 格式要求：data 行中不能有換行符
        // 如果 JSON 本身包含換行，需要確保每行都以 "data: " 開頭
        const lines = jsonData.split('\n');
        
        res.write(`event: ${eventType}\n`);
        
        if (lines.length === 1) {
            // 單行 JSON，直接發送
            res.write(`data: ${jsonData}\n\n`);
        } else {
            // 多行 JSON，每行都需要 "data: " 前綴
            lines.forEach(line => {
                res.write(`data: ${line}\n`);
            });
            res.write('\n');
        }
    } catch (e) {
        console.error("❌ Error sending SSE event:", e);
        console.error("Event type:", eventType);
        console.error("Data:", data);
    }
}

function parseTripDays(tripDaysStr) {
    if (!tripDaysStr) return 1;
    const str = String(tripDaysStr).trim();
    if (str === "2" || str.includes("兩天") || str.includes("二日")) return 2;
    if (str === "3" || str.includes("三天") || str.includes("三日")) return 3;
    if (str === "4" || str.includes("四天") || str.includes("四日")) return 4;
    if (str === "5" || str.includes("五天") || str.includes("五日")) return 5;
    if (str === "1" || str.includes("一天") || str.includes("一日")) return 1;
    return 1; // Default
}

/**
 * 從用戶查詢中提取旅遊偏好關鍵字
 */
function extractPreferencesFromQuery(query) {
    const preferences = [];
    const keywords = {
        '親子': ['親子', '小孩', '兒童', '家庭'],
        '美食': ['美食', '小吃', '餐廳', '吃'],
        '文化': ['文化', '古蹟', '歷史', '博物館'],
        '自然': ['自然', '山', '海', '風景', '步道'],
        '休閒': ['休閒', '放鬆', '漫步'],
        '拍照': ['拍照', '打卡', '網美']
    };
    
    for (const [pref, words] of Object.entries(keywords)) {
        if (words.some(word => query.includes(word))) {
            preferences.push(pref);
        }
    }
    
    return preferences.length > 0 ? preferences : ['一般旅遊'];
}

function buildPrompt(question, location, days, dates, weatherData, ragContext = null) {
    let prompt = `你是一位台灣的專業旅遊行程設計師，擅長針對台灣各地設計詳細的行程規劃。

用戶需求：${question}
目的地：${location}
天數：${days}天
日期：${dates.join(', ')}

`;

    if (weatherData && Object.keys(weatherData).length > 0) {
        prompt += "天氣預報：\n";
        for (const date in weatherData) {
            const weather = weatherData[date];
            if (weather && !weather.error) {
                prompt += `- ${date}：${weather.condition || '未知'}，`;
                prompt += `溫度 ${weather.temp || '?'}°C `;
                prompt += `(${weather.min_temp || '?'}-${weather.max_temp || '?'})°C，`;
                prompt += `降雨機率 ${weather.rain_chance || '?'}%，`;
                prompt += `紫外線 ${weather.uvi || '未知'}\n`;
                if (weather.description) {
                    prompt += `天氣提醒：${weather.description}\n`;
                }
            }
        }
        prompt += "\n";
    }

    // 加入 RAG 檢索的真實景點和餐廳資料
    if (ragContext) {
        prompt += ragContext;
    }

    prompt += `請根據上述天氣資訊和你的專業知識，為用戶設計最適合的台灣旅遊行程。

⚠️ 強制要求（必須嚴格遵守）：
${(location.includes('嘉義') && !question.includes('阿里山') && !question.includes('山')) ? '0. **地點限制**: 用戶偏好嘉義市區或平原行程，請盡量避免安排阿里山、梅山、奮起湖等遠距離山區景點，除非用戶明確要求。\n' : ''}1. **每天至少安排 3-4 個景點**（建議 4-6 個景點）
2. **每天至少安排 2 餐**（午餐 + 晚餐必須有，早餐可選）
3. **不得出現超過 2 小時的空白時段**（除了睡眠時間）
4. **行程時間**: 每天從 09:00 開始，到 18:00-19:00 結束
5. **時間必須連貫**: 前一個活動結束時間 ≤ 下一個活動開始時間
6. **起點與終點**：如果用戶在需求中指定了起點或終點（例如「從台北車站出發」、「結束在台北車站」），請務必在行程的第一個和最後一個項目安排該地點。

基本規則：
1. 每個行程項目都必須包含 "day" 欄位，表示是第幾天（從1開始編號，直到 ${days} 天）。
2. **時間欄位使用建議停留時間（小時）**，而不是具體時間範圍。例如："1.5小時"、"2小時"、"0.5小時"等。
3. 地點名稱必須是具體的、可在地圖上找到的真實景點名稱。
4. 絕對禁止使用幻想或不存在的地點名稱。
5. **不要安排任何交通時間項目**，系統會自動計算並插入真實的交通時間。
6. 絕對不要安排「咖啡漫步」、「休息」等模糊活動。
7. 絕對不要推薦或安排「住宿」、「飯店」、「旅館」等過夜地點。
8. 飲食請推薦具體店家名稱或知名美食街、夜市。
9. 路線應合理安排，避免不必要的來回走動。
10. 使用繁體中文。
11. 你的回應必須是可直接解析的純 JSON，不包含任何其他文字。
12. ${ragContext ? '**優先使用上述「可用的真實景點和餐廳資料」中的地點來規劃行程，這些都是經過驗證的真實存在的景點。**' : ''}
13. **請為每個行程項目標記類型**：如果是午餐或晚餐，請在 JSON 中加入 "type": "lunch" 或 "type": "dinner"。其他活動可標記為 "type": "activity"。

標準時間配置範例：
- 早餐（可選）
- 景點1（建議停留 1.5 小時）
- 景點2（建議停留 2 小時）
- 午餐（建議停留 1 小時）
- 景點3（建議停留 1.5 小時）
- 景點4（建議停留 1 小時）
- 晚餐（建議停留 1 小時）

請嚴格使用以下 JSON 格式回答（這只是一個範例，請根據天數產生對應的內容）：
{
  "title": "行程標題",
  "sections": [
    {
      "time": "建議停留 1.5 小時",
      "location": "第一個具體的地點名稱",
      "details": ["活動詳情1", "活動詳情2"],
      "day": 1,
      "type": "activity"
    },
    {
      "time": "建議停留 1 小時",
      "location": "午餐餐廳名稱",
      "details": ["用餐"],
      "day": 1,
      "type": "lunch"
    }
  ]
}`;
    return prompt;
}

function calculateTripStatistics(tripData) {
    if (!tripData.sections) return;

    let totalTravelSeconds = 0;
    tripData.sections.forEach(section => {
        if (section.travel_info && section.travel_info.duration_value) {
            totalTravelSeconds += section.travel_info.duration_value;
        }
    });

    const totalPlayingMinutes = calculatePlayingTime(tripData.sections);
    const totalTravelMinutes = Math.round(totalTravelSeconds / 60);
    const totalTimeMinutes = totalPlayingMinutes + totalTravelMinutes;

    if (totalTimeMinutes > 0) {
        const travelRatio = (totalTravelMinutes / totalTimeMinutes) * 100;
        
        const formatTime = (minutes) => {
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            if (h > 0) return `${h}小時${m > 0 ? `${m}分` : ''}`;
            return `${m}分鐘`;
        };

        tripData.playing_time_display = formatTime(totalPlayingMinutes);
        tripData.travel_ratio_display = `${travelRatio.toFixed(1)}%`;
        tripData.total_travel_time_display = formatTime(totalTravelMinutes);
    }
}


export default async function handler(req, res) {
    // 設置 CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Respond to frontend health check
    if (req.method === 'GET') {
        res.status(200).json({ status: 'ok', message: 'Backend is running.' });
        return;
    }

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no',
    });

    try {
        const { question: naturalLanguageQuery, useRAG = true } = req.body;
        if (!naturalLanguageQuery) {
            throw new Error("Missing question parameter");
        }

        console.log(`🔧 處理請求 - useRAG: ${useRAG}`);

        // 1. 使用 Gemini 解析用戶的自然語言輸入
        sendSseEvent(res, 'parsing', { status: 'start_query_parsing' });
        const parsedQuery = await parseQueryWithGemini(naturalLanguageQuery, res);
        sendSseEvent(res, 'parsing_result', { result: parsedQuery }); // <--- 新增的除錯事件

        if (parsedQuery.error) {
            console.warn(`解析用戶查詢失敗: ${parsedQuery.error}`);
        }
        
        const locationName = parsedQuery.location || "台灣";
        const cityForWeather = parsedQuery.city || locationName;
        const tripDays = parseTripDays(parsedQuery.days);
        const tripDates = calculateTripDates(naturalLanguageQuery, tripDays);
        
        sendSseEvent(res, 'parsing', { status: 'complete_query_parsing', data: { location: locationName, days: tripDays, dates: tripDates } });

        // 2. 平行執行：獲取天氣資訊 和 RAG 檢索
        sendSseEvent(res, 'weather', { status: 'fetching' });
        if (useRAG) sendSseEvent(res, 'rag', { status: 'retrieving' });

        const weatherPromise = getMultiDayWeatherSync(cityForWeather, tripDates);
        
        let ragPromise = Promise.resolve(null);
        if (useRAG) {
            console.log('🔍 開始 RAG 檢索...');
            const userParams = {
                location: locationName,
                city: cityForWeather,
                days: tripDays,
                tripType: naturalLanguageQuery.includes('親子') ? '親子遊' : 
                          naturalLanguageQuery.includes('美食') ? '美食之旅' : 
                          naturalLanguageQuery.includes('文化') ? '文化之旅' : '一般旅遊',
                preferences: extractPreferencesFromQuery(naturalLanguageQuery),
                specialRequirements: naturalLanguageQuery
            };
            
            // 執行 RAG 檢索 (不設超時，確保必須使用 RAG)
            ragPromise = retrieveRelevantData(userParams, {
                attractionLimit: tripDays * 8,
                restaurantLimit: tripDays * 5,
                threshold: 0.7,
                separateQueries: true
            }).catch(err => {
                console.error('❌ RAG 檢索發生嚴重錯誤:', err.message);
                // 只有在真的出錯時才返回 null，否則盡量等待
                return null;
            });
        }

        const [weatherData, retrievalResult] = await Promise.all([weatherPromise, ragPromise]);

        // 處理天氣結果
        const weatherArray = tripDates.map(date => ({ date, weather: weatherData[date] || null }));
        sendSseEvent(res, 'weather', { status: 'complete', data: weatherArray });

        // 處理 RAG 結果
        let ragContext = null;
        let ragRawData = null;

        if (useRAG) {
            if (retrievalResult) {
                ragContext = formatRetrievalForPrompt(retrievalResult, tripDays);
                ragRawData = {
                    attractions: retrievalResult.attractions,
                    restaurants: retrievalResult.restaurants
                };
                console.log(`✅ RAG 檢索完成，檢索到 ${ragContext.length} 字元的上下文`);
                sendSseEvent(res, 'rag', { status: 'complete', contextLength: ragContext.length });
            } else {
                sendSseEvent(res, 'rag', { status: 'error', error: 'Retrieval failed' });
            }
        } else {
            console.log('🚫 跳過 RAG 檢索（useRAG=false）');
            sendSseEvent(res, 'rag', { status: 'skipped', message: '使用純 AI 生成模式' });
        }

        // 4. 準備生成參數
        const finalQuestion = `請幫我規劃在「${locationName}」的「${tripDays}天」行程。原始需求是：「${naturalLanguageQuery}」`;

        // 3. 生成兩個不同的行程方案
        const generateItinerary = async (useRAGForGeneration, ragContextForGeneration) => {
            console.log(`🎯 生成行程方案 - useRAG: ${useRAGForGeneration}`);

            // 建立對應的提示
            const prompt = buildPrompt(finalQuestion, locationName, tripDays, tripDates, weatherData, ragContextForGeneration);

            // Gemini Streaming
            // 用戶確認有 gemini-2.5-flash，恢復使用
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
            });

            const result = await model.generateContentStream({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.7,
                    topP: 0.95,
                    topK: 40,
                }
            });

            let fullResponseText = '';
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullResponseText += chunkText;
            }

            // Parse and Enrich
            let tripData = JSON.parse(fullResponseText);
            
            // 1. Enrich with Maps Data (but skip travel times for now)
            // 為了避免 Vercel Timeout，將地圖資料補充移至前端執行
            // tripData = await enrichWithMapsData(tripData, cityForWeather, { insertTravelTimes: false });

            // 1.5 嘗試從 RAG 資料中回填座標，以便進行地理優化
            if (useRAGForGeneration && ragRawData) {
                const coordMap = new Map();
                const addToMap = (items) => {
                    if (!items) return;
                    items.forEach(item => {
                        if (item.name) {
                            coordMap.set(item.name, { lat: item.lat || item.latitude, lng: item.lng || item.longitude });
                        }
                    });
                };
                addToMap(ragRawData.attractions);
                addToMap(ragRawData.restaurants);

                tripData.sections.forEach(section => {
                    // 如果已經有座標就跳過
                    if (section.lat && section.lng) return;

                    // 嘗試精確匹配
                    if (coordMap.has(section.location)) {
                        const coords = coordMap.get(section.location);
                        section.lat = coords.lat;
                        section.lng = coords.lng;
                    } else {
                        // 嘗試模糊匹配
                        for (const [name, coords] of coordMap.entries()) {
                            if (section.location.includes(name) || name.includes(section.location)) {
                                section.lat = coords.lat;
                                section.lng = coords.lng;
                                break;
                            }
                        }
                    }
                });
            }

            // 1.6 補充剩餘缺失的座標 (使用 Google Maps API 輕量查詢)
            // 這是為了確保 GeoOptimizer 能正常運作，即使 RAG 沒有覆蓋到所有地點
            tripData = await enrichWithCoordinates(tripData, cityForWeather);

            // 2. Optimize Itinerary (Lunch Constraint)
            const sectionsByDay = {};
            tripData.sections.forEach(section => {
                if (!sectionsByDay[section.day]) sectionsByDay[section.day] = [];
                sectionsByDay[section.day].push(section);
            });

            let optimizedSections = [];
            // Sort days to ensure order
            const days = Object.keys(sectionsByDay).sort((a, b) => parseInt(a) - parseInt(b));
            
            for (const day of days) {
                const daySections = sectionsByDay[day];
                // Optimize day
                const optimizedDay = optimizeDayWithLunch(daySections);
                optimizedSections = [...optimizedSections, ...optimizedDay];
            }
            tripData.sections = optimizedSections;

            // 3. Add Travel Times (Optional, can be triggered by frontend later)
            // tripData = await addTravelTimes(tripData);

            // Final Statistics
            calculateTripStatistics(tripData);

            // 加入標記
            tripData.useRAG = useRAGForGeneration;
            tripData.generationMethod = useRAGForGeneration ? 'RAG 增強（真實景點資料庫）' : '純 AI 生成';

            return {
                title: tripData.title || `${locationName} ${useRAGForGeneration ? '真實景點' : 'AI創意'} 行程`,
                sections: tripData.sections || [],
                useRAG: tripData.useRAG,
                generationMethod: tripData.generationMethod,
                playing_time_display: tripData.playing_time_display,
                travel_ratio_display: tripData.travel_ratio_display,
                total_travel_time_display: tripData.total_travel_time_display
            };
        };

        sendSseEvent(res, 'generation', { status: 'starting' });

        // 生成行程方案
        // 優化：如果是多天行程，為了避免超時，只生成 RAG 行程
        const tasks = [];
        
        // 總是生成 RAG 行程 (如果 useRAG 為 true)
        if (useRAG) {
             tasks.push(generateItinerary(true, ragContext));
        } else {
             // 如果強制不使用 RAG，則生成 AI 行程
             tasks.push(generateItinerary(false, null));
        }

        // 只有在單日行程且時間允許的情況下，才額外生成純 AI 對照組
        // 或者如果 useRAG 為 false，上面已經加了一個，這裡就不加了
        if (tripDays === 1 && useRAG) {
            tasks.push(generateItinerary(false, null));
        }

        const generatedItineraries = await Promise.all(tasks);

        // 確保 itineraries 陣列順序正確 (AI在前, RAG在後，或者根據生成順序)
        // 這裡我們簡單地將所有生成的行程放入陣列
        // 如果只有一個，前端會自動處理
        const itineraries = generatedItineraries.sort((a, b) => {
            // 讓純 AI 生成的排在前面 (如果有的話)，這只是為了保持一致性
            return (a.useRAG === b.useRAG) ? 0 : a.useRAG ? 1 : -1;
        });

        sendSseEvent(res, 'generation', { status: 'completed' });

        // 組合最終數據
        const formattedTripData = {
            location: locationName,
            start_date: tripDates[0],
            weather_data: weatherArray,
            question: naturalLanguageQuery,
            prompt: `包含 ${itineraries.length} 個行程方案`,
            itineraries: itineraries,
            rag_raw_data: ragRawData // 加入原始 RAG 數據
        };

        sendSseEvent(res, 'result', { data: formattedTripData });

        // 7. Done
        sendSseEvent(res, 'done', { status: 'complete' });

    } catch (e) {
        console.error("API Error:", e);
        sendSseEvent(res, 'error', { message: e.message });
    } finally {
        res.end();
    }
}
