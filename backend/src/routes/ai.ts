import { Router } from 'express';

const router = Router();

// DeepSeek API Proxy to avoid CORS
router.post('/chat', async (req, res) => {
    const API_KEY = process.env.DEEPSEEK_API_KEY || req.headers['x-api-key'] as string;

    if (!API_KEY) {
        return res.status(400).json({ error: 'API key required' });
    }

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error: any) {
        console.error('DeepSeek proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
