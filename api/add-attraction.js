import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function createEmbedding(text) {
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('生成向量失敗:', error.message);
    throw error;
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const { name, category, city, district, address, description, features, phone, website, opening_hours } = req.body;

      if (!name || !city || !description) {
        return res.status(400).json({ error: 'Missing required fields: name, city, description' });
      }

      // Construct text for embedding
      // Combine important fields to create a rich semantic representation
      const textToEmbed = `${name} ${category || ''} ${city} ${district || ''} ${description} ${features ? features.join(' ') : ''}`;
      
      console.log(`Generating embedding for: ${name}`);
      const embedding = await createEmbedding(textToEmbed);

      const { data, error } = await supabase
        .from('tourist_attractions')
        .insert([
          {
            name,
            category,
            city,
            district,
            address,
            description,
            features: features || [],
            phone,
            website,
            opening_hours,
            embedding
          }
        ])
        .select();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error adding attraction:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
