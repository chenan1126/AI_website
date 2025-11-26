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
 * 使用 Gemini API 解析用戶的自然語言輸入，提取縣市和天數。
 * @param {string} query - 用戶的原始查詢
 * @returns {Promise<object>} - 解析後的物件 { city, days }
 */
async function parseQueryWithGemini(query, res) {
    if (!GEMINI_API_KEY) {
        console.error("缺少 Gemini API Key");
        return { city: "台灣", days: "一日遊", activity_preferences: [], dietary_preferences: [], error: "錯誤: 未設置 Gemini API Key" };
    }
    try {
        // console.log(`開始使用 Gemini 解析用戶查詢: ${query}`);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        const prompt = `你是一個專門解析旅遊需求的 AI。請從以下句子中提取『主要遊玩地點所屬的台灣縣市』、『旅遊天數』、『活動偏好』和『飲食偏好』。

句子: "${query}"

你的回應必須是可直接解析的純 JSON 格式，不包含任何其他說明文字、markdown 標籤或程式碼區塊。
絕對不要使用 \`\`\`json 或任何類似的標籤。
JSON 格式: {
    "city": "縣市", 
    "days": "天數",
    "activity_preferences": ["偏好1", "偏好2"],
    "dietary_preferences": ["偏好1", "偏好2"]
}

說明：
1. 'city': 必須是台灣的真實縣市名稱（例如：台北市、台中市、嘉義縣、花蓮縣等）。
2. 'days': 如果沒有明確天數，請根據上下文推斷（例如「週末」是兩天），若無法推斷則預設為「一日遊」。
3. 'activity_preferences': 提取用戶對景點類型、特定主題或具體活動的偏好（例如：自然、古蹟、親子、爬山、看海、室內、戶外、看貓、有冷氣、文青等）。請盡量保留用戶的具體形容詞。若無則回傳空陣列。
4. 'dietary_preferences': 提取用戶對食物的偏好（例如：小吃、海鮮、素食、甜點、餐廳等）。若無則回傳空陣列。

範例：
- 輸入: "想去阿里山看日出，順便吃火雞肉飯"
- 輸出: {"city": "嘉義縣", "days": "一日遊", "activity_preferences": ["自然", "日出", "山林"], "dietary_preferences": ["火雞肉飯", "小吃"]}
- 輸入: "明天去高雄玩兩天，想去駁二跟吃海鮮"
- 輸出: {"city": "高雄市", "days": "兩天", "activity_preferences": ["藝文", "展覽"], "dietary_preferences": ["海鮮"]}
- 輸入: "明天我想要去一趟嘉義，想要看貓"
- 輸出: {"city": "嘉義市", "days": "一日遊", "activity_preferences": ["貓咪", "動物", "寵物"], "dietary_preferences": []}
- 輸入: "去嘉義玩"
- 輸出: {"city": "嘉義市", "days": "一日遊", "activity_preferences": [], "dietary_preferences": []}

規則：
1. **特別規則**：如果用戶只提到「嘉義」而沒有明確說「嘉義縣」或「阿里山」等山區地名，請務必將 'city' 設為「嘉義市」。這是為了區分市區旅遊和山區旅遊。
2. **排除交通節點**：如果用戶提到「車站」、「高鐵」、「機場」等作為起點、終點或集合點，請提取主要的遊玩城市或區域。`;

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

        if (!parsedData.days || !parsedData.city) {
             console.error(`Gemini 解析結果缺少必要欄位: ${JSON.stringify(parsedData)}`);
             return { 
                 city: parsedData.city || "台灣", 
                 days: parsedData.days || "一日遊", 
                 activity_preferences: parsedData.activity_preferences || [],
                 dietary_preferences: parsedData.dietary_preferences || [],
                 error: "解析不完整" 
             };
        }
        // console.log(`Gemini 解析完成:`, parsedData);
        return parsedData;

    } catch (e) {
        console.error(`使用 Gemini 解析用戶查詢時出錯: ${e}`);
        // 降級處理：如果解析失敗，至少返回一個預設值
        return { city: "台灣", days: "一日遊", activity_preferences: [], dietary_preferences: [], error: `解析查詢時出錯: ${e.message}` };
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
 * 移除 RAG 資料中的向量數據，並只保留必要欄位以減少傳輸大小
 */
function sanitizeRagData(data) {
    if (!data) return null;
    const sanitize = (items) => {
        if (!Array.isArray(items)) return [];
        return items.map(item => ({
            name: item.name,
            address: item.address || item.vicinity || item.formatted_address || ''
        }));
    };
    return {
        attractions: sanitize(data.attractions),
        restaurants: sanitize(data.restaurants)
    };
}

/**
 * 從用戶查詢中提取結構化的偏好設定（來自前端整合的 Prompt）
 */
function extractStructuredPreferences(query) {
    const result = {
        activityPreferences: [],
        dietaryPreferences: []
    };

    // Extract Activity Preferences
    const activityMatch = query.match(/活動偏好：([^\n]+)/);
    if (activityMatch) {
        result.activityPreferences = activityMatch[1].split('、').map(s => s.trim());
    }

    // Extract Dietary Preferences
    const dietaryMatch = query.match(/飲食偏好：([^\n]+)/);
    if (dietaryMatch) {
        result.dietaryPreferences = dietaryMatch[1].split('、').map(s => s.trim());
    }

    return result;
}

function buildPrompt(question, location, days, dates, weatherData, ragContext = null) {
    const isRAG = !!ragContext;
    
    let prompt = `你是一位台灣的專業旅遊行程設計師，擅長針對台灣各地設計詳細的行程規劃。

用戶需求：${question}
目的地：${location}
天數：${days}天
日期：${dates.join(', ')}

`;

    let hasWeatherInfo = false;
    if (weatherData && Object.keys(weatherData).length > 0) {
        let weatherSection = "天氣預報：\n";
        for (const date in weatherData) {
            const weather = weatherData[date];
            if (weather && !weather.error) {
                hasWeatherInfo = true;
                weatherSection += `- ${date}：${weather.condition || '未知'}，`;
                weatherSection += `溫度 ${weather.temp || '?'}°C `;
                weatherSection += `(${weather.min_temp || '?'}-${weather.max_temp || '?'})°C，`;
                weatherSection += `降雨機率 ${weather.rain_chance || '?'}%，`;
                weatherSection += `紫外線 ${weather.uvi || '未知'}\n`;
                if (weather.description) {
                    weatherSection += `天氣提醒：${weather.description}\n`;
                }
            }
        }
        if (hasWeatherInfo) {
            prompt += weatherSection + "\n";
        }
    }

    if (!hasWeatherInfo) {
        prompt += "天氣預報：無天氣資料\n\n";
    }

    if (isRAG) {
        // ==========================================
        // RAG 模式專用 Prompt (嚴格限制資料來源)
        // ==========================================
        prompt += ragContext;
        prompt += `請根據上述天氣資訊和你的專業知識，為用戶設計最適合的台灣旅遊行程。

⚠️ RAG 模式強制要求（必須嚴格遵守）：
1. **嚴格限制（Closed World Assumption）**：你只能從上述「可用的真實景點和餐廳資料」清單中選擇地點。絕對禁止使用任何不在清單中的地點。即使你知道某個地點很有名，只要它不在清單上，就不能使用。如果清單中的地點不夠，請重複使用或減少行程點，絕不可自行創造或引入外部地點。
2. **優先使用景點**：請優先從「景點列表」中選擇 4-6 個地點作為主要行程。如果檢索結果中有足夠的景點（例如 10 個以上），請務必使用它們，不要忽略。
3. **餐廳限制**：餐廳只能用於「午餐」和「晚餐」。絕對禁止將餐廳當作景點來安排（例如：不要安排「去某某餐廳參觀」）。
4. **每天只能安排 2 餐**（午餐 + 晚餐）。絕對禁止安排早餐、下午茶、宵夜或點心時間，除非用戶明確要求。
5. **不得出現超過 2 小時的空白時段**（除了睡眠時間）。
6. **行程時間**: 每天從 09:00 開始，到 18:00-19:00 結束。
7. **時間必須連貫**: 前一個活動結束時間 ≤ 下一個活動開始時間。
8. **起點與終點**：如果用戶在需求中指定了起點或終點，請務必遵守。
`;
    } else {
        // ==========================================
        // 純 AI 模式專用 Prompt (創意生成)
        // ==========================================
        prompt += `請根據上述天氣資訊和你的專業知識，發揮你的創意，為用戶設計最適合的台灣旅遊行程。

⚠️ 純 AI 模式要求：
1. **發揮創意**：你可以自由推薦你認為最棒的真實景點和餐廳，不受限制。
2. **真實性**：雖然可以自由推薦，但地點必須是真實存在的。
${(location.includes('嘉義') && !question.includes('阿里山') && !question.includes('山')) ? '3. **地點限制**: 用戶偏好嘉義市區或平原行程，請盡量避免安排阿里山、梅山、奮起湖等遠距離山區景點，除非用戶明確要求。\n' : ''}
4. **每天至少安排 3-4 個景點**（建議 4-6 個景點）。
5. **每天只能安排 2 餐**（午餐 + 晚餐）。絕對禁止安排早餐、下午茶、宵夜或點心時間，除非用戶明確要求。
6. **不得出現超過 2 小時的空白時段**（除了睡眠時間）。
7. **行程時間**: 每天從 09:00 開始，到 18:00-19:00 結束。
8. **時間必須連貫**: 前一個活動結束時間 ≤ 下一個活動開始時間。
9. **起點與終點**：如果用戶在需求中指定了起點或終點，請務必遵守。
`;
    }

    // 通用規則
    prompt += `
基本規則：
1. 每個行程項目都必須包含 "day" 欄位，表示是第幾天（從1開始編號，直到 ${days} 天）。
2. **時間欄位請只回傳數字（代表小時）**，例如：1.5, 2, 0.5。不要加「小時」或「分鐘」等文字。
3. 地點名稱必須是具體的、可在地圖上找到的真實景點名稱。
4. 絕對禁止使用幻想或不存在的地點名稱。
5. **不要安排任何交通時間項目**，系統會自動計算並插入真實的交通時間。
6. 絕對不要安排「咖啡漫步」、「休息」等模糊活動。
7. 絕對不要推薦或安排「住宿」、「飯店」、「旅館」等過夜地點。
8. 飲食請推薦具體店家名稱或知名美食街、夜市。
9. 路線應合理安排，避免不必要的來回走動。
10. 使用繁體中文。
11. 你的回應必須是可直接解析的純 JSON，不包含任何其他文字。
12. **請為每個行程項目標記類型**：如果是午餐或晚餐，請在 JSON 中加入 "type": "lunch" 或 "type": "dinner"。其他活動可標記為 "type": "activity"。

標準時間配置範例：
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
      "time": 1.5,
      "location": "第一個具體的地點名稱",
      "details": ["活動詳情1", "活動詳情2"],
      "day": 1,
      "type": "activity"
    },
    {
      "time": 1,
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
        
        const city = parsedQuery.city || "台灣";
        const tripDays = parseTripDays(parsedQuery.days);
        const tripDates = calculateTripDates(naturalLanguageQuery, tripDays);
        
        sendSseEvent(res, 'parsing', { status: 'complete_query_parsing', data: { location: city, days: tripDays, dates: tripDates } });

        // 2. 平行執行：獲取天氣資訊 和 RAG 檢索
        sendSseEvent(res, 'weather', { status: 'fetching' });
        if (useRAG) sendSseEvent(res, 'rag', { status: 'retrieving' });

        const weatherPromise = getMultiDayWeatherSync(city, tripDates);
        
        let ragPromise = Promise.resolve(null);
        if (useRAG) {
            console.log('🔍 開始 RAG 檢索...');
            
            // 優先使用 Gemini 解析出的偏好
            // 如果前端有傳送結構化的偏好字串（例如 "活動偏好：..."），Gemini 應該也能解析出來
            // 但為了保險起見，我們也可以保留 extractStructuredPreferences 作為備用或合併
            
            const structuredPrefs = extractStructuredPreferences(naturalLanguageQuery);
            
            // 合併偏好 (去重)
            const activityPrefs = [...new Set([
                ...(parsedQuery.activity_preferences || []),
                ...(structuredPrefs.activityPreferences || [])
            ])];
            
            const dietaryPrefs = [...new Set([
                ...(parsedQuery.dietary_preferences || []),
                ...(structuredPrefs.dietaryPreferences || [])
            ])];

            console.log('🧩 [RAG] 解析出的偏好 (Gemini + 結構化):', JSON.stringify({ activityPrefs, dietaryPrefs }));

            const userParams = {
                city: city,
                days: tripDays,
                tripType: naturalLanguageQuery.includes('親子') ? '親子遊' : '一般旅遊',
                preferences: [...activityPrefs, ...dietaryPrefs], // 綜合偏好
                activityPreferences: activityPrefs,
                dietaryPreferences: dietaryPrefs,
                specialRequirements: naturalLanguageQuery
            };
            
            console.log('📤 [RAG] 傳送給檢索器的參數:', JSON.stringify(userParams, null, 2));
            
            // 執行 RAG 檢索 (不設超時，確保必須使用 RAG)
            ragPromise = retrieveRelevantData(userParams, {
                attractionLimit: tripDays * 10, // 每天 10 個景點
                restaurantLimit: tripDays * 5,  // 每天 5 個餐廳
                threshold: 0.35, // 降低門檻，確保能抓到更多景點
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
                console.log(`📄 RAG Context Preview: ${ragContext.substring(0, 500)}...`);
                sendSseEvent(res, 'rag', { status: 'complete', contextLength: ragContext.length });
            } else {
                sendSseEvent(res, 'rag', { status: 'error', error: 'Retrieval failed' });
            }
        } else {
            console.log('🚫 跳過 RAG 檢索（useRAG=false）');
            sendSseEvent(res, 'rag', { status: 'skipped', message: '使用純 AI 生成模式' });
        }

        // 4. 準備生成參數
        const finalQuestion = `請幫我規劃在「${city}」的「${tripDays}天」行程。原始需求是：「${naturalLanguageQuery}」`;

        // 3. 生成兩個不同的行程方案
        const generateItinerary = async (useRAGForGeneration, ragContextForGeneration) => {
            console.log(`🎯 生成行程方案 - useRAG: ${useRAGForGeneration}`);

            // 建立對應的提示
            const prompt = buildPrompt(finalQuestion, city, tripDays, tripDates, weatherData, ragContextForGeneration);

            if (useRAGForGeneration) {
                console.log('📝 [RAG模式] 最終發送給 Gemini 的 Prompt (前 1000 字):');
                console.log('--------------------------------------------------');
                console.log(prompt.substring(0, 1000));
                console.log('... (略) ...');
                console.log('--------------------------------------------------');
            }

            // Gemini Streaming
            // RAG 使用 gemini-2.5-flash (平衡速度與指令遵循)，純 AI 使用 gemini-2.5-flash (最新模型)
            const modelName = useRAGForGeneration ? "gemini-2.5-flash" : "gemini-2.5-flash";
            const model = genAI.getGenerativeModel({
                model: modelName,
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

            // 1.5 準備 RAG 地址對照表，並進行地圖資料補充
            // 用戶需求：RAG 資料已有正確地址，優先使用 RAG 地址進行搜尋與顯示
            // 但 RAG 缺乏 Rating 與 Opening Hours，因此仍需調用 Google Maps API 補充
            const knownAddresses = {};
            if (useRAGForGeneration && ragRawData) {
                const addToMap = (items) => {
                    if (!items) return;
                    items.forEach(item => {
                        if (item.name && (item.address || item.vicinity || item.formatted_address)) {
                            knownAddresses[item.name] = item.address || item.vicinity || item.formatted_address;
                        }
                    });
                };
                addToMap(ragRawData.attractions);
                addToMap(ragRawData.restaurants);
            }

            // 1. Enrich with Maps Data (but skip travel times for now)
            // 恢復地圖資料補充功能，並傳入 knownAddresses 以提高準確度
            tripData = await enrichWithMapsData(tripData, city, { insertTravelTimes: false }, knownAddresses);

            // 1.6 補充剩餘缺失的座標 (使用 Google Maps API 輕量查詢)
            // 這是為了確保 GeoOptimizer 能正常運作，即使 RAG 沒有覆蓋到所有地點
            tripData = await enrichWithCoordinates(tripData, city);

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

            console.log(useRAGForGeneration ? '✅ RAG 生成完畢' : '✅ AI 生成完畢');

            return {
                title: tripData.title || `${city} ${useRAGForGeneration ? '真實景點' : 'AI創意'} 行程`,
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
        // 生成兩個版本進行比較：RAG 版本（資料庫資料）+ AI 版本（創意生成）
        const tasks = [];
        
        // 1. 總是生成 RAG 行程 (使用資料庫資料)
        if (useRAG && ragContext) {
             tasks.push(generateItinerary(true, ragContext));
        }

        // 2. 同時生成純 AI 行程 (使用 AI 創意生成，不使用 RAG)
        tasks.push(generateItinerary(false, null));

        const generatedItineraries = await Promise.all(tasks);

        // 確保 itineraries 陣列順序正確 (AI在前, RAG在後)
        const itineraries = generatedItineraries.sort((a, b) => {
            // 讓純 AI 生成的排在前面，RAG 排在後面
            return (a.useRAG === b.useRAG) ? 0 : a.useRAG ? 1 : -1;
        });

        sendSseEvent(res, 'generation', { status: 'completed' });

        // 淨化 RAG 數據，移除向量欄位以減少傳輸大小
        const sanitizedRagData = sanitizeRagData(ragRawData);

        // 組合最終數據
        const formattedTripData = {
            location: city,
            start_date: tripDates[0],
            weather_data: weatherArray,
            question: naturalLanguageQuery,
            prompt: `包含 ${itineraries.length} 個行程方案`,
            itineraries: itineraries,
            rag_raw_data: sanitizedRagData // 使用淨化後的數據
        };

        // 記錄數據大小以便除錯
        try {
            const dataSize = JSON.stringify(formattedTripData).length;
            console.log(`📦 準備發送最終結果，數據大小: ${Math.round(dataSize / 1024)} KB`);
        } catch (e) {
            console.error('無法計算數據大小:', e);
        }

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
