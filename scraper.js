require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

/**
 * Robustly scrapes odds for a single MLB game.
 * Targets the Odds Comparison section to get consensus totals.
 */
async function scrapeGame(browser, gameUrl) {
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    try {
        console.log(`Scraping game: ${gameUrl}`);
        await page.goto(gameUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        // 1. Locate the Odds Comparison section
        const comparisonSection = page.locator('div, section').filter({ hasText: /Odds Comparison/i }).filter({ has: page.locator('table') }).last();
        
        if (!await comparisonSection.isVisible()) {
            console.log('Comparison section not found');
            return null;
        }

        // 2. Select Over/Under market
        const marketDropdown = comparisonSection.locator('select').filter({ hasText: /over\/under/i });
        if (await marketDropdown.isVisible()) {
            await marketDropdown.selectOption('total');
            await page.waitForTimeout(2000);
        }

        // Helper to extract the O/U pair from the Consensus row
        async function getConsensusOU(section) {
            return await section.evaluate(node => {
                const rows = Array.from(node.querySelectorAll('tr'));
                const consensusRow = rows.find(r => r.innerText.includes('Consensus'));
                if (consensusRow) {
                    const matches = consensusRow.innerText.match(/([ou]\d+\.?\d*)/g);
                    if (matches && matches.length >= 2) return `${matches[0]} ${matches[1]}`;
                    if (matches && matches.length === 1) return matches[0];
                }
                return 'N/A';
            });
        }

        // 3. Extract Full Game Consensus
        const fullGameOU = await getConsensusOU(comparisonSection);

        // 4. Switch to F5 Period
        const f5Tab = comparisonSection.locator('.period-selector__item', { hasText: 'F5' });
        let f5OU = 'N/A';
        if (await f5Tab.isVisible()) {
            await f5Tab.click({ force: true });
            await page.waitForTimeout(4000);
            f5OU = await getConsensusOU(comparisonSection);
        }

        // 5. Extract Team Names from H1
        const teams = await page.evaluate(() => {
            const h1 = document.querySelector('h1')?.innerText || '';
            const match = h1.match(/(.+) vs\. (.+) Odds/);
            if (match) {
                return { away: match[1].trim(), home: match[2].trim() };
            }
            return { away: 'Unknown', home: 'Unknown' };
        });

        return { 
            away: teams.away, 
            home: teams.home, 
            fullGameOpenOU: fullGameOU, 
            f5OpenOU: f5OU,
            status: 'success'
        };
    } catch (e) {
        console.error(`Error scraping ${gameUrl}:`, e.message);
        return null;
    } finally {
        await context.close();
    }
}

/**
 * Main scraper entry point.
 */
async function scrapeMLB() {
    console.log('Launching browser with stealth on Termux...');
    const browser = await chromium.launch({ 
        headless: true,
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    
    try {
        const page = await browser.newPage();
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

async function pushDataToServer(data) {
    if (!data || data.length === 0) return;
    try {
        const response = await fetch(`${RENDER_URL}/api/odds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: API_KEY, data })
        });
        const result = await response.json();
        console.log('Server response:', result);
    } catch (e) {
        console.error('Failed to push data to server:', e.message);
    }
}

async function runLocalScraper() {
    console.log(`[${new Date().toLocaleString()}] Starting local scrape process...`);
    const data = await scrapeMLB();
    console.log(`Scrape finished, pushing ${data.length} records to ${RENDER_URL}`);
    await pushDataToServer(data);
    console.log(`[${new Date().toLocaleString()}] Process complete. Sleeping...`);
}

if (require.main === module) {
    runLocalScraper();
    setInterval(runLocalScraper, 60 * 60 * 1000);
}

module.exports = { scrapeMLB, scrapeGame, pushDataToServer };
