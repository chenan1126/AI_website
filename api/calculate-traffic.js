
import { enrichWithMapsData } from './_utils.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { sections, location } = await req.json();

    if (!sections || !Array.isArray(sections)) {
      return new Response(JSON.stringify({ error: 'Invalid sections data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 建立一個臨時的 tripData 對象
    const tripData = {
      sections: sections,
      location: location || '台灣'
    };

    // 使用 enrichWithMapsData 重新計算交通時間
    // 我們假設地點已經有 maps_data (如果沒有，它會嘗試獲取)
    // 重點是 insertTravelTimes: true
    const enrichedData = await enrichWithMapsData(tripData, tripData.location, { insertTravelTimes: true });

    return new Response(JSON.stringify({ 
      sections: enrichedData.sections 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Calculate traffic error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
