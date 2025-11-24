import dotenv from 'dotenv';
import fs from 'fs';
import { retrieveRelevantData, formatRetrievalForPrompt } from './api/utils/ragRetriever.js';

dotenv.config();

async function main() {
    console.log("開始執行真實 RAG 檢索測試...");

    const userParams = {
        location: "台北市",
        city: "台北市",
        days: 1,
        tripType: "一般旅遊",
        preferences: ["文化", "美食", "自然"],
        specialRequirements: "想去台北101和吃鼎泰豐"
    };

    console.log("模擬用戶參數:", userParams);

    try {
        // 1. 執行檢索
        console.log("正在檢索資料...");
        const retrievalResult = await retrieveRelevantData(userParams, {
            attractionLimit: 10,
            restaurantLimit: 5,
            threshold: 0.35,
            separateQueries: true
        });

        console.log(`檢索完成。找到 ${retrievalResult.attractions.length} 個景點, ${retrievalResult.restaurants.length} 個餐廳。`);

        // 2. 格式化 Prompt
        console.log("正在格式化 Prompt...");
        const formattedContext = formatRetrievalForPrompt(retrievalResult, userParams.days);

        // 3. 寫入檔案
        const outputPath = 'REAL_RAG_CONTEXT.md';
        fs.writeFileSync(outputPath, formattedContext, 'utf8');
        
        console.log(`\n✅ 真實 RAG Context 已寫入至: ${outputPath}`);
        console.log("請打開該檔案查看實際發送給 LLM 的內容。");

    } catch (error) {
        console.error("❌ 發生錯誤:", error);
    }
}

main();
