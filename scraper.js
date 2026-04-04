const { chromium } = require('playwright');

async function scrapeGame(browser, gameUrl) {
    const page = await browser.newPage();
    try {
        await page.goto(gameUrl, { waitUntil: 'networkidle', timeout: 45000 });
        
        // 1. Select "over/under" (value 'total') from the correct dropdown
        // Based on analysis, it's the select that has options spread, ml, total
        const selectHandle = await page.evaluateHandle(() => {
            return Array.from(document.querySelectorAll('select')).find(s => {
                const vals = Array.from(s.options).map(o => o.value);
                return vals.includes('spread') && vals.includes('ml') && vals.includes('total');
            });
        });

        if (selectHandle) {
            await selectHandle.asElement().selectOption('total');
            await page.waitForTimeout(2000);
        }

        async function getOpenLine() {
            return await page.evaluate(() => {
                const table = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('SportsBook'));
                if (!table) return 'N/A';
                const rows = Array.from(table.querySelectorAll('tr'));
                const openRow = rows.find(r => r.innerText.includes('Open'));
                if (!openRow) return 'N/A';
                const cells = Array.from(openRow.querySelectorAll('td')).map(c => c.innerText.trim().replace(/\n/g, ' '));
                // cells[0] is "Open", cells[1] is Over, cells[2] is Under
                if (cells.length >= 3) return `${cells[1]} / ${cells[2]}`;
                return 'N/A';
            });
        }

        // 2. Get Full Game
        const fullGameOpenOU = await getOpenLine();

        // 3. Click F5
        const f5Btn = page.locator('.period-selector__item').filter({ hasText: /^F5$/ }).first();
        let f5OpenOU = 'N/A';
        if (await f5Btn.isVisible()) {
            await f5Btn.click();
            await page.waitForTimeout(2000);
            f5OpenOU = await getOpenLine();
        }

        // 4. Get Team Names
        const teams = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            if (h1) {
                const parts = h1.innerText.split(' vs. ');
                if (parts.length === 2) return { away: parts[0].trim(), home: parts[1].split(' Odds')[0].trim() };
            }
            return { away: 'Unknown', home: 'Unknown' };
        });

        return { 
            away: teams.away, 
            home: teams.home, 
            fullGameOpenOU, 
            f5OpenOU 
        };
    } catch (e) {
        console.error(`Error scraping ${gameUrl}:`, e.message);
        return null;
    } finally {
        await page.close();
    }
}

async function scrapeMLB() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        console.log('Fetching game links...');
        await page.goto('https://www.actionnetwork.com/mlb/odds', { waitUntil: 'networkidle' });
        
        const gameLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href.includes('/mlb-game/'));
        });
        const uniqueLinks = [...new Set(gameLinks)];
        console.log(`Found ${uniqueLinks.length} games. Starting detailed scrape...`);
        
        const results = [];
        // Process in small batches to avoid detection/memory issues
        for (let i = 0; i < uniqueLinks.length; i += 2) {
            const batch = uniqueLinks.slice(i, i + 2);
            const batchResults = await Promise.all(batch.map(link => scrapeGame(browser, link)));
            results.push(...batchResults.filter(r => r !== null));
        }
        
        return results;
    } finally {
        await browser.close();
    }
}

module.exports = { scrapeMLB };
