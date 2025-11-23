import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

  if (req.method === 'GET') {
    const { page = 1, limit = 20, search = '', city = '', category = '' } = req.query;
    
    // Ensure page and limit are numbers to avoid string concatenation issues
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabase
      .from('tourist_attractions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    
    if (city) {
      // Special handling for Chiayi and Hsinchu because the data import script
      // normalized both City and County to "City" (e.g., 嘉義縣 -> 嘉義 -> 嘉義市).
      // So we must rely on the address field to distinguish them.
      if (city === '嘉義縣') {
        query = query.ilike('address', '%嘉義縣%');
      } else if (city === '嘉義市') {
        query = query.ilike('address', '%嘉義市%');
      } else if (city === '新竹縣') {
        query = query.ilike('address', '%新竹縣%');
      } else if (city === '新竹市') {
        query = query.ilike('address', '%新竹市%');
      } else {
        query = query.eq('city', city);
      }
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      data,
      count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
