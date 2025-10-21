// api/index.js - Health check endpoint
export default async function handler(req, res) {
    // 設置 CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow GET requests for health check
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    // Health check response
    res.status(200).json({
        status: 'ok',
        message: 'AI Trip Planner API is running.',
        timestamp: new Date().toISOString(),
        endpoints: {
            ask: '/api/ask'
        }
    });
}