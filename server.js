require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.SCRAPER_API_KEY || 'default-secret-key';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// In-memory cache
let cachedData = [];
let lastScrapedTime = null;
let isScraping = false; // Still used to show status on frontend

// Endpoint to receive data from local scraper
app.post('/api/odds', (req, res) => {
     const { key, data } = req.body; if (key !== API_KEY) return res.status(403).json({ success: false, error: 'Unauthorized' });
    
    if (!Array.isArray(data)) {
        return res.status(400).json({ success: false, error: 'Invalid data format' });
    }

    cachedData = data;
    lastScrapedTime = new Date();
    isScraping = false;
    
    console.log(`[${new Date().toLocaleTimeString()}] Received update: ${data.length} games.`);
    res.json({ success: true, received: data.length });
});

// Endpoint to check server version
app.get('/api/version', (req, res) => {
    res.json({ version: '1.0.1', timestamp: new Date() });
});

// Endpoint to get the current cached data
app.get('/api/odds', (req, res) => {
    res.json({ 
        success: true, 
        data: cachedData, 
        lastUpdated: lastScrapedTime,
        isScraping: isScraping
    });
});

// Endpoint to indicate a scrape has started (called by local scraper)
app.post('/api/scrape-status', (req, res) => {
    const { key, status } = req.body;
    if (key === API_KEY) {
        isScraping = (status === 'started');
        res.json({ success: true });
    } else {
        res.status(403).json({ success: false });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server v1.0.1 running at http://localhost:${PORT}`);
    console.log(`API Key for local scraper: ${API_KEY}`);
});
