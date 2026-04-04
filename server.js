const express = require('express');
const { scrapeMLB } = require('./scraper');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory cache
let cachedData = [];
let lastScrapedTime = null;
let isScraping = false;

async function performScrape() {
    if (isScraping) return;
    isScraping = true;
    console.log(`[${new Date().toLocaleTimeString()}] Starting scheduled scrape...`);
    try {
        const data = await scrapeMLB();
        cachedData = data;
        lastScrapedTime = new Date();
        console.log(`[${new Date().toLocaleTimeString()}] Scrape successful. ${data.length} games found.`);
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] Scrape failed:`, error.message);
    } finally {
        isScraping = false;
    }
}

// Run initial scrape after a delay to ensure server is fully started
setTimeout(() => {
    performScrape();
}, 5000);

// Schedule scrape every hour (3600000 ms)
setInterval(performScrape, 60 * 60 * 1000);

app.use(express.static('public'));

// Endpoint to get the current cached data
app.get('/api/odds', (req, res) => {
    res.json({ 
        success: true, 
        data: cachedData, 
        lastUpdated: lastScrapedTime,
        isScraping: isScraping
    });
});

// Endpoint to manually trigger a scrape
app.get('/api/scrape-manual', async (req, res) => {
    if (isScraping) {
        return res.status(429).json({ success: false, error: 'Scrape already in progress' });
    }
    await performScrape();
    res.json({ 
        success: true, 
        data: cachedData, 
        lastUpdated: lastScrapedTime 
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
