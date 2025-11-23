import { getPlaceDetailsSync } from './_utils.js';

export default async function handler(req, res) {
    // CORS
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
        const { placeName, location } = req.body;
        
        if (!placeName) {
            res.status(400).json({ error: 'Missing placeName' });
            return;
        }

        const details = await getPlaceDetailsSync(placeName, location || "台灣");
        
        // 為了前端一致性，這裡做一些數據轉換
        if (details.error) {
            res.status(200).json({ error: details.error, is_closed: details.is_closed });
        } else {
            res.status(200).json({
                maps_data: {
                    rating: details.rating || 0,
                    user_ratings_total: details.user_ratings_total || 0,
                    address: details.address || '',
                    google_maps_name: details.name || placeName,
                    opening_hours: details.opening_hours,
                    phone: details.phone,
                    website: details.website,
                    photo_url: details.photos && details.photos.length > 0 
                        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${details.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
                        : null
                },
                coordinates: details.location ? {
                    lat: details.location.lat,
                    lng: details.location.lng
                } : null
            });
        }
    } catch (error) {
        console.error('Error in get-place-details:', error);
        res.status(500).json({ error: error.message });
    }
}
