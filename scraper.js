require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
async function getTotals(page) {
    return await page.evaluate(() => {
        const table = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Matchup') && t.innerText.includes('Total'));
        if (table) {
            const text = table.innerText;
            const oMatch = text.match(/o\d+\.?\d*/);
            const uMatch = text.match(/u\d+\.?\d*/);
            // Full Game totals table might not have 'Over' in the header row, but it has 'Total'
            if (oMatch && uMatch) {
                return `${oMatch[0]} ${uMatch[0]}`;
            }
        }
        return 'N/A';
    });
}


async function getF5Totals(page) {
    return await page.evaluate(() => {
        const tables = Array.from(document.querySelectorAll('table')).filter(t => t.innerText.includes('Matchup'));
        const table = tables[1];
        if (table) {
            const rows = Array.from(table.querySelectorAll('tr'));
            for (const row of rows) {
                const text = row.innerText;
                const oMatch = text.match(/o\d+\.?\d*/);
                const uMatch = text.match(/u\d+\.?\d*/);
                if (oMatch && uMatch && !text.includes('Over')) {
                    return `${oMatch[0]} ${uMatch[0]}`;
                }
            }
        }
        return 'N/A';
    });
}

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

        const fullGameOpenOU = await getTotals(page);
        
        let f5OpenOU = 'N/A';
        const f5Tab = page.locator('.period-selector__item', { hasText: 'F5' }).first();
        if (await f5Tab.isVisible()) {
            await f5Tab.click();
            await page.waitForTimeout(5000);
            f5OpenOU = await getF5Totals(page);
        }

        const teams = await page.evaluate(() => {
            const h1 = document.querySelector('h1')?.innerText || '';
            const match = h1.match(/(.+) vs\. (.+) Odds/);
            return match ? { away: match[1].trim(), home: match[2].trim() } : { away: 'Unknown', home: 'Unknown' };
        });

        return { 
            awayTeam: teams.away, 
            homeTeam: teams.home, 
            fullGameOpenOU: fullGameOpenOU, 
            f5OpenOU: f5OpenOU,
            status: 'success'
        };
    } catch (e) {
        console.error(`Error scraping ${gameUrl}:`, e.message);
        return { awayTeam: null, homeTeam: null, fullGameOpenOU: null, f5OpenOU: null, status: 'error' };
    } finally {
        await context.close();
    }
}

async function scrapeMLB() {
    console.log('Launching browser with stealth on Termux...');
    const browser = await chromium.launch({ 
        headless: true,
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    try {
        const page = await browser.newPage();
        await page.goto('https://www.actionnetwork.com/mlb/odds', { waitUntil: 'domcontentloaded' });
        const gameLinks = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes('/mlb-game/')));
        const uniqueLinks = [...new Set(gameLinks)];
        const results = [];
        for (const link of uniqueLinks) results.push(await scrapeGame(browser, link));
        return results;
    } finally {
        await browser.close();
    }
}

const RENDER_URL = 'https://mlb-odds-scraper.onrender.com';
const API_KEY = 'my_mlb_secret_777';

async function pushDataToServer(data) {
    await fetch(`${RENDER_URL}/api/odds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: API_KEY, data })
    });
}

module.exports = { scrapeMLB, scrapeGame, pushDataToServer };
