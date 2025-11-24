
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

async function test() {
    const text = "金門縣 金城鎮 三犬西餐廳 三犬西餐廳位於金門縣金城鎮自1983年開業至今歡迎所有來到金門縣民或是來到金門觀光的人都能來店裡品嚐三犬西餐廳獨特的美味佳餚。為什麼叫三犬理由很簡單因為老闆家中有三個兄弟所以命名之。三犬西餐廳的室內布置是很民歌西餐廰的感覺不管是店面的佈置、餐具的擺設到整家店的氛圍都讓人感受到很六年代的氣氛。不只如此在牆面上一張張大幅的圖騰更讓人印象深刻之處一幅幅以音樂為主題的圖畫彷彿置身民歌西餐廳當中。當您來到金門時不妨來試試金門道地、口味獨特的三犬西餐廳保證會讓您回味無窮的 金門縣金城鎮珠浦北路28之1號 餐廳 美食";
    
    console.log("Testing text length:", text.length);
    console.log("Text:", text);
    console.log("Char codes:", JSON.stringify(text.split('').map(c => c.charCodeAt(0))));

    try {
        // Correct content structure + outputDimensionality
        const result = await model.embedContent({
            content: { parts: [{ text: text }] }, 
            taskType: 'RETRIEVAL_DOCUMENT',
            outputDimensionality: 768 
        });
        console.log("Success! Embedding length:", result.embedding.values.length);
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.error("Response:", JSON.stringify(e.response, null, 2));
        }
    }
}

test();
