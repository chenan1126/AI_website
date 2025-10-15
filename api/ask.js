// api/ask.js
import dotenv from 'dotenv';
dotenv.config();

import {
    getMultiDayWeatherSync,
    getPlaceDetailsSync,
    calculateRouteDistanceAndTimeSync,
    calculateTripDates,
    calculatePlayingTime,
    calculateWilsonScore
} from './_utils.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getRAGContext } from './utils/ragRetriever.js';

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
        console.log(`開始使用 Gemini 解析用戶查詢: ${query}`);
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

規則：
1. 'location' 必須是台灣的真實地點。
2. 'city' 必須是 'location' 所屬的台灣縣市。如果無法判斷，請將 'city' 設為與 'location' 相同。
3. 'days' 如果沒有明確天數，請根據上下文推斷（例如「週末」是兩天），若無法推斷則預設為「一日遊」。`;

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
        console.log(`Gemini 解析完成:`, parsedData);
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

重要規則：
1. 每個行程項目都必須包含 "day" 欄位，表示是第幾天（從1開始編號，直到 ${days} 天）。
2. 時間欄位只包含時間範圍，不要包含天數標記。
3. 地點名稱必須是具體的、可在地圖上找到的真實景點名稱。
4. 絕對禁止使用幻想或不存在的地點名稱。
5. 絕對不要安排任何「交通時間」、「移動時間」等交通相關項目。
6. 絕對不要安排「咖啡漫步」、「休息」等模糊活動。
7. 絕對不要推薦或安排「住宿」、「飯店」、「旅館」等過夜地點。
8. 飲食請推薦具體店家名稱或知名美食街、夜市。
9. 路線應合理安排，避免不必要的來回走動。
10. 使用繁體中文。
11. 你的回應必須是可直接解析的純 JSON，不包含任何其他文字。
12. ${ragContext ? '**優先使用上述「可用的真實景點和餐廳資料」中的地點來規劃行程，這些都是經過驗證的真實存在的景點。**' : ''}
請嚴格使用以下 JSON 格式回答（這只是一個範例，請根據天數產生對應的內容）：
{
  "title": "行程標題",
  "sections": [
    {
      "time": "09:00-10:30",
      "location": "第一個具體的地點名稱",
      "details": ["活動詳情1", "活動詳情2"],
      "day": 1
    },
    {
      "time": "11:00-12:30",
      "location": "第二個具體的地點名稱",
      "details": ["活動詳情1"],
      "day": 1
    }
  ]
}`;
    return prompt;
}

async function enrichWithMapsData(tripData, cityLocation) {
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
                    wilson_score: calculateWilsonScore(mapsInfo.rating, mapsInfo.user_ratings_total)
                };
            }
        }
        return enrichedSection;
    });

    const routePromises = [];
    for (let i = 0; i < sectionsWithMaps.length - 1; i++) {
        const currentSection = sectionsWithMaps[i];
        const nextSection = sectionsWithMaps[i+1];
        
        if (currentSection.day === nextSection.day && currentSection.location && nextSection.location) {
            // 使用Places API返回的地址，如果沒有地址則使用地點名稱
            const originAddress = currentSection.maps_data?.address || currentSection.location;
            const destAddress = nextSection.maps_data?.address || nextSection.location;
            
            const promise = calculateRouteDistanceAndTimeSync(originAddress, destAddress)
                .then(routeData => {
                    if (!routeData.error) {
                        // 使用具體地址或Google Maps名稱，如果沒有則使用原始名稱
                        const fromName = currentSection.maps_data?.google_maps_name || currentSection.maps_data?.address || currentSection.location;
                        const toName = nextSection.maps_data?.google_maps_name || nextSection.maps_data?.address || nextSection.location;

                        currentSection.travel_info = {
                            from: fromName,
                            to: toName,
                            distance: routeData.distance_text || '',
                            duration: routeData.duration_text || '',
                            duration_value: routeData.duration_value || 0,
                            mode: routeData.mode || 'driving'
                        };
                    }
                });
            routePromises.push(promise);
        }
    }
    await Promise.all(routePromises);

    tripData.sections = sectionsWithMaps;
    return tripData;
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
    // Respond to frontend health check
    if (req.method === 'GET') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json({ status: 'ok', message: 'Backend is running.' });
        return;
    }

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

        // 2. 獲取天氣資訊
        sendSseEvent(res, 'weather', { status: 'fetching' });
        const weatherData = await getMultiDayWeatherSync(cityForWeather, tripDates);
        const weatherArray = tripDates.map(date => ({ date, weather: weatherData[date] || null }));
        sendSseEvent(res, 'weather', { status: 'complete', data: weatherArray });

        // 3. RAG 檢索真實景點和餐廳資料（可選）
        let ragContext = null;
        if (useRAG) {
            sendSseEvent(res, 'rag', { status: 'retrieving' });
            try {
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
                
                ragContext = await getRAGContext(userParams, {
                    attractionLimit: tripDays * 8,  // 每天約8個景點
                    restaurantLimit: tripDays * 5,  // 每天約5個餐廳選擇
                    threshold: 0.7,
                    separateQueries: true
                });
                
                console.log(`✅ RAG 檢索完成，檢索到 ${ragContext.length} 字元的上下文`);
                sendSseEvent(res, 'rag', { status: 'complete', contextLength: ragContext.length });
            } catch (ragError) {
                console.warn('⚠️ RAG 檢索失敗，將不使用向量檢索:', ragError.message);
                sendSseEvent(res, 'rag', { status: 'error', error: ragError.message });
                ragContext = null;
            }
        } else {
            console.log('🚫 跳過 RAG 檢索（useRAG=false）');
            sendSseEvent(res, 'rag', { status: 'skipped', message: '使用純 AI 生成模式' });
        }

        // 4. 建立增強版提示（包含 RAG 上下文，如果有的話）
        const finalQuestion = `請幫我規劃在「${locationName}」的「${tripDays}天」行程。原始需求是：「${naturalLanguageQuery}」`;
        const prompt = buildPrompt(finalQuestion, locationName, tripDays, tripDates, weatherData, ragContext);

        // --- DEBUG: 將完整的 prompt 送到前端 ---
        sendSseEvent(res, 'debug_prompt', { prompt: prompt, useRAG: useRAG });
        // -----------------------------------------

        // 5. Gemini Streaming
        sendSseEvent(res, 'generation', { status: 'starting' });
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
            sendSseEvent(res, 'generation', { status: 'generating', chunk: chunkText });
        }
        sendSseEvent(res, 'generation', { status: 'completed' });

        // 5. Parse and Enrich
        sendSseEvent(res, 'parsing_response', { status: 'parsing' });
        let tripData = JSON.parse(fullResponseText);

        sendSseEvent(res, 'maps', { status: 'fetching' });
        tripData = await enrichWithMapsData(tripData, locationName);
        sendSseEvent(res, 'maps', { status: 'completed' });

        // 6. Final Statistics and Result
        calculateTripStatistics(tripData);
        
        // 加入 RAG 使用標記
        tripData.useRAG = useRAG;
        tripData.generationMethod = useRAG ? 'RAG 增強（真實景點資料庫）' : '純 AI 生成';
        
        sendSseEvent(res, 'result', { data: tripData });

        // 7. Done
        sendSseEvent(res, 'done', { status: 'complete' });

    } catch (e) {
        console.error("API Error:", e);
        sendSseEvent(res, 'error', { message: e.message });
    } finally {
        res.end();
    }
}
