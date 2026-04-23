require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function scrapeGame(browser, gameUrl) {
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    try {
        console.log(`Scraping game: ${gameUrl}`);
        await page.goto(gameUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        async function getTotalsFromSection() {
            return await page.evaluate(() => {
                const table = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Matchup') && t.innerText.includes('Total'));
                if (table) {
                    const text = table.innerText;
                    // Cardinals row for total: "Cardinals 14-9 +1.5 +1.5 -167 o8 -116 +124"
                    // Match 'o' or 'u' followed by a digit. 
                    const matches = text.match(/([ou]\d+\.?\d*)/g);
                    // Filter out the 'o0.5' player props if present, keep only the totals (>= 7)
                    if (matches) {
                        const totals = matches.filter(m => parseFloat(m.substring(1)) >= 3);
                        if (totals.length >= 2) return `${totals[0]} ${totals[1]}`;
                    }
                }
                return 'N/A';
            });
        }

        const fullGameOU = await getTotalsFromSection();

        let f5OU = 'N/A';
        const f5Tab = page.locator('.period-selector__item').filter({ hasText: /^F5$/i }).first();
        if (await f5Tab.isVisible()) {
            await f5Tab.evaluate(el => el.click());
            await page.waitForTimeout(3000);
            f5OU = await getTotalsFromSection();
        }

        const teams = await page.evaluate(() => {
            const h1 = document.querySelector('h1').innerText;
            const parts = h1.split(' vs. ');
            return { away: parts[0].trim(), home: parts[1].split(' Odds')[0].trim() };
        });

        return { 
            matchup: `${teams.away} vs. ${teams.home}`,
            full_game_ou: fullGameOU,
            f5_ou: f5OU,
            status: 'success'
        };
    } catch (e) {
        console.error(`Error scraping ${gameUrl}:`, e.message);
        return { matchup: 'Unknown', full_game_ou: null, f5_ou: null, status: 'error' };
    } finally {
        await context.close();
    }
}

async function scrapeMLB() {
    console.log('Launching browser with stealth on Termux...');
    const browser = await chromium.launch({ 
        headless: true,
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();
        
        console.log('Fetching game links from Action Network...');
        await page.goto('https://www.actionnetwork.com/mlb/odds', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        await page.waitForSelector('a[href*="/mlb-game/"]', { timeout: 15000 }).catch(() => console.log('Timeout waiting for game links'));

        const gameLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href.includes('/mlb-game/'));
        });
        
        const uniqueLinks = [...new Set(gameLinks)];
        console.log(`Found ${uniqueLinks.length} games. Starting detailed scrape...`);
        
        const results = [];
        for (let i = 0; i < uniqueLinks.length; i++) {
            const link = uniqueLinks[i];
            console.log(`[${i + 1}/${uniqueLinks.length}] Scraping: ${link}`);
            const result = await scrapeGame(browser, link);
            if (result) results.push(result);
        }
        
        console.log(`Scrape complete. Successfully fetched ${results.length} games.`);
        return results;
    } catch (err) {
        console.error('Main scrape loop error:', err.message);
        return [];
    } finally {
        await browser.close();
    }
}

const RENDER_URL = 'https://mlb-odds-scraper.onrender.com';
const API_KEY = 'my_mlb_secret_777';

async function updateServerStatus(status) {
    try {
        await fetch(`${RENDER_URL}/api/scrape-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: API_KEY, status })
        });
    } catch (e) {
        console.error('Failed to update server status:', e.message);
    }
}

async function pushDataToServer(data) {
    try {
        const response = await fetch(`${RENDER_URL}/api/odds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: API_KEY, data })
        });
        
        const text = await response.text();
        try {
            const result = JSON.parse(text);
            console.log('Server response:', result);
        } catch (e) {
            console.error('Server returned non-JSON response:', text.substring(0, 200));
        }
    } catch (e) {
        console.error('Failed to push data to server:', e.message);
    }
}

async function runLocalScraper() {
    console.log(`[${new Date().toLocaleString()}] Starting local scrape process...`);
    await updateServerStatus('started');
    const data = await scrapeMLB();
    console.log(`Scrape finished, pushing ${data.length} records to ${RENDER_URL}`);
    await pushDataToServer(data);
    await updateServerStatus('finished');
    console.log(`[${new Date().toLocaleString()}] Process complete. Sleeping...`);
}

if (require.main === module) {
    runLocalScraper();
    setInterval(runLocalScraper, 60 * 60 * 1000);
}

module.exports = { scrapeMLB, scrapeGame, pushDataToServer };
