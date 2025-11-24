
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModel(modelName, dim) {
  console.log(`Testing ${modelName} with requested dimension: ${dim}`);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const params = {
      content: { parts: [{ text: "Hello world" }] }
    };
    
    if (dim) {
        params.outputDimensionality = dim;
    }

    const result = await model.embedContent(params);
    const values = result.embedding.values;
    console.log(`✅ ${modelName} returned ${values.length} dimensions.`);
    return values.length;
  } catch (error) {
    console.error(`❌ ${modelName} failed:`, error.message);
    return null;
  }
}

async function main() {
    await testModel('gemini-embedding-001', 3072);
    await testModel('text-embedding-004', 3072);
    await testModel('text-embedding-004', 768);
}

main();
