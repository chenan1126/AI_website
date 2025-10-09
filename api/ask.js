// api/ask.js
import {
    getMultiDayWeatherSync,
    getPlaceDetailsSync,
    calculateRouteDistanceAndTimeSync,
    calculateTripDates,
    extractCityName as extractCityNameFromUtils, // Rename to avoid conflict
    calculatePlayingTime,
    calculateWilsonScore
} from './_utils.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

你的回應必須是可直接解析的純 JSON 格式，不包含任何其他說明文字。
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
        const rawText = response.text();
        
        // 將原始回覆傳送到前端
        if (res) {
            sendSseEvent(res, 'raw_parsing_response', { raw: rawText });
        }

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
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
        console.error("Error sending SSE event:", e);
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

function buildPrompt(question, location, days, dates, weatherData) {
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

    prompt += `請根據上述天氣資訊和你的專業知識，為用戶設計最適合的台灣旅遊行程。

重要規則：
1. 每個行程項目都必須包含 "day" 欄位，表示是第幾天（從1開始編號，直到 ${days} 天）。
2. 時間欄位只包含時間範圍，不要包含天數標記。
3. 地點名稱必須是具體的、可在地圖上找到的真實景點名稱。
4. 絕對禁止使用幻想或不存在的地點名稱。
5. 絕對不要安排任何「交通時間」、「移動時間」等交通相關項目。
6. 絕對不要安排「咖啡漫步」、「休息」等模糊活動。
7. 住宿與飲食請推薦具體店家名稱。
8. 路線應合理安排，避免不必要的來回走動。
9. 使用繁體中文。
10. 你的回應必須是可直接解析的純 JSON，不包含任何其他文字。
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
            }
        })
    );
    await Promise.all(placePromises);

    const sectionsWithMaps = tripData.sections.map(section => {
        const enrichedSection = { ...section };
        const placeName = section.location;
        if (placeName && placesData[placeName]) {
            const mapsInfo = placesData[placeName];
            enrichedSection.maps_data = {
                rating: mapsInfo.rating || 0,
                user_ratings_total: mapsInfo.user_ratings_total || 0,
                address: mapsInfo.address || '',
                google_maps_name: mapsInfo.name || placeName,
                wilson_score: calculateWilsonScore(mapsInfo.rating, mapsInfo.user_ratings_total)
            };
        }
        return enrichedSection;
    });

    const routePromises = [];
    for (let i = 0; i < sectionsWithMaps.length - 1; i++) {
        const currentSection = sectionsWithMaps[i];
        const nextSection = sectionsWithMaps[i+1];
        
        if (currentSection.day === nextSection.day && currentSection.location && nextSection.location) {
            const promise = calculateRouteDistanceAndTimeSync(currentSection.location, nextSection.location)
                .then(routeData => {
                    if (!routeData.error) {
                        currentSection.travel_info = {
                            from: currentSection.location,
                            to: nextSection.location,
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
        const { question: naturalLanguageQuery } = req.body;
        if (!naturalLanguageQuery) {
            throw new Error("Missing question parameter");
        }

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

        // 3. 建立增強版提示
        const finalQuestion = `請幫我規劃在「${locationName}」的「${tripDays}天」行程。原始需求是：「${naturalLanguageQuery}」`;
        const prompt = buildPrompt(finalQuestion, locationName, tripDays, tripDates, weatherData);

        // --- DEBUG: 將完整的 prompt 送到前端 ---
        sendSseEvent(res, 'debug_prompt', { prompt: prompt });
        // -----------------------------------------

        // 4. Gemini Streaming
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
