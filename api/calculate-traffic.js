
import { addTravelTimes } from './_utils.js';

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
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        const { sections, location } = req.body;

        if (!sections || !Array.isArray(sections)) {
            return res.status(400).json({ error: 'Invalid sections data' });
        }

        console.log(`[Traffic] Calculating traffic for ${sections.length} sections in ${location || 'unknown location'}`);

        // 建構一個符合 addTravelTimes 預期的 tripData 物件
        const tripData = {
            sections: sections,
            location: location
        };

        // 計算交通時間
        const enrichedTripData = await addTravelTimes(tripData);

        res.status(200).json({ 
            sections: enrichedTripData.sections,
            message: 'Traffic calculation complete' 
        });

    } catch (error) {
        console.error('[Traffic] Error calculating traffic:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
