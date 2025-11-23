import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客戶端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // 設置 CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { attractionName, reportType, description } = req.body;

    if (!attractionName || !reportType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // 插入回報資料
    const { data, error } = await supabase
      .from('attraction_reports')
      .insert([
        {
          attraction_name: attractionName,
          report_type: reportType,
          description: description || '',
          status: 'pending'
        }
      ]);

    if (error) {
      throw error;
    }

    console.log(`收到景點回報: ${attractionName} - ${reportType}`);

    res.status(200).json({ success: true, message: 'Report submitted successfully' });

  } catch (error) {
    console.error('Report submission failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
