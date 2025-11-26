
import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function testModel(modelName) {
    console.log(`\n🧪 Testing model: ${modelName}`);
    const model = genAI.getGenerativeModel({ model: modelName });

    const text1 = "嘉義市的博物館";
    const text2 = "嘉義市 東區 嘉義市立博物館 完整呈現極具深度的嘉義巿位於文化中心園區的市立博物館，負責相關文物的蒐藏、研究、展示與教育。";

    try {
        const res1 = await model.embedContent({
            content: { parts: [{ text: text1 }] },
            outputDimensionality: 768
        });
        const res2 = await model.embedContent({
            content: { parts: [{ text: text2 }] },
            outputDimensionality: 768
        });

        const vec1 = res1.embedding.values;
        const vec2 = res2.embedding.values;

        const sim = cosineSimilarity(vec1, vec2);
        console.log(`Similarity: ${sim.toFixed(4)}`);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

async function run() {
    await testModel('gemini-embedding-001');
    await testModel('text-embedding-004');
}

run();
