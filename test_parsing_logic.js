import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from '@google/generative-ai';

// 配置 Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function parseQueryWithGemini(query) {
    if (!GEMINI_API_KEY) {
        console.error("缺少 Gemini API Key");
        return { city: "台灣", days: "一日遊", activity_preferences: [], dietary_preferences: [], error: "錯誤: 未設置 Gemini API Key" };
    }
    try {
        console.log(`開始使用 Gemini 解析用戶查詢: ${query}`);
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
- 輸出: {"city": "嘉義市", "days": "一日遊", "activity_preferences": ["看貓", "動物", "寵物"], "dietary_preferences": []}
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
        console.log(`Gemini 解析完成:`, parsedData);
        return parsedData;

    } catch (e) {
        console.error(`使用 Gemini 解析用戶查詢時出錯: ${e}`);
        return { city: "台灣", days: "一日遊", activity_preferences: [], dietary_preferences: [], error: `解析查詢時出錯: ${e.message}` };
    }
}

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

async function runTest() {
    const naturalLanguageQuery = "明天我想要去嘉義玩，喜歡博物館！";
    
    console.log("--- 測試開始 ---");
    console.log(`原始查詢: "${naturalLanguageQuery}"`);

    // 1. 模擬 Gemini 解析
    const parsedQuery = await parseQueryWithGemini(naturalLanguageQuery);

    // 2. 模擬偏好提取與合併
    const structuredPrefs = extractStructuredPreferences(naturalLanguageQuery);
    
    const activityPrefs = [...new Set([
        ...(parsedQuery.activity_preferences || []),
        ...(structuredPrefs.activityPreferences || [])
    ])];
    
    const dietaryPrefs = [...new Set([
        ...(parsedQuery.dietary_preferences || []),
        ...(structuredPrefs.dietaryPreferences || [])
    ])];

    console.log("\n--- 解析結果 ---");
    console.log("City:", parsedQuery.city);
    console.log("Days:", parsedQuery.days);
    console.log("Activity Prefs (Final):", activityPrefs);
    console.log("Dietary Prefs (Final):", dietaryPrefs);

    // 3. 模擬 RAG 參數構建
    const userParams = {
        city: parsedQuery.city,
        days: parsedQuery.days,
        tripType: naturalLanguageQuery.includes('親子') ? '親子遊' : '一般旅遊',
        preferences: [...activityPrefs, ...dietaryPrefs],
        activityPreferences: activityPrefs,
        dietaryPreferences: dietaryPrefs,
        specialRequirements: naturalLanguageQuery
    };

    console.log("\n--- RAG 參數 (userParams) ---");
    console.log(JSON.stringify(userParams, null, 2));

    // 4. 模擬 RAG 搜尋字串構建 (參考 ragRetriever.js 的邏輯)
    console.log("\n--- 模擬 RAG 搜尋字串 ---");
    
    const locationTerm = userParams.city || '台灣';
    
    // 景點查詢
    let attractionQuery = '';
    if (userParams.activityPreferences && userParams.activityPreferences.length > 0) {
        attractionQuery = `${locationTerm}的${userParams.activityPreferences.join('、')}景點`;
    } else {
        attractionQuery = `${locationTerm}景點`;
    }
    // 注意：我們已經移除了 specialRequirements 的拼接
    console.log(`[景點搜尋字串]: "${attractionQuery}"`);

    // 餐廳查詢
    let restaurantQuery = '';
    if (userParams.dietaryPreferences && userParams.dietaryPreferences.length > 0) {
        restaurantQuery = `${locationTerm}的${userParams.dietaryPreferences.join('、')}餐廳`;
    } else {
        restaurantQuery = `${locationTerm}美食餐廳`;
    }
    console.log(`[餐廳搜尋字串]: "${restaurantQuery}"`);

    console.log("\n--- 測試結束 ---");
}

runTest();
