
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function checkRecord() {
    console.log("🔍 Checking database for '嘉義市立博物館'...");
    
    const { data, error } = await supabase
        .from('tourist_attractions')
        .select('*')
        .eq('name', '嘉義市立博物館');

    if (error) {
        console.error("❌ Error:", error);
        return;
    }

    if (data && data.length > 0) {
        const item = data[0];
        console.log(`✅ Found record: ${item.name}`);
        
        // Parse vector from DB
        const dbVector = JSON.parse(item.embedding);
        console.log(`   DB Vector Dim: ${dbVector.length}`);

        // Generate query vector
        console.log("   Generating query vector for '嘉義市的博物館'...");
        const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await model.embedContent({
            content: { parts: [{ text: "嘉義市的博物館" }] },
            outputDimensionality: 768
        });
        const queryVector = result.embedding.values;

        // Compute similarity
        const sim = cosineSimilarity(dbVector, queryVector);
        console.log(`   Calculated Similarity: ${sim.toFixed(4)}`);

    } else {
        console.log("❌ Record NOT found in database.");
    }
}

checkRecord();
