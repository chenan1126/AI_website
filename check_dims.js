
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDims() {
    const { data, error } = await supabase.rpc('check_embedding_dims');
    
    if (error) {
        // If function doesn't exist, try to create it or just run raw query if possible (can't run raw query easily)
        // So I'll try to create the function first via SQL editor... oh wait I can't.
        // I'll try to use a simple select with rpc if I can define it.
        console.error("Error calling RPC:", error);
        
        // Fallback: Try to select one record and check length of JSON parsed embedding if possible
        // But client returns string.
        const { data: rows } = await supabase.from('tourist_attractions').select('embedding').limit(1);
        if (rows && rows.length > 0) {
            const vecStr = rows[0].embedding;
            // It's a string "[0.1, ...]"
            const vec = JSON.parse(vecStr);
            console.log(`Vector dimension in DB (JS parsed): ${vec.length}`);
        }
    } else {
        console.log("Dims:", data);
    }
}

checkDims();
