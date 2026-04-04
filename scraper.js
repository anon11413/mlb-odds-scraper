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
        
        // Wait for page to load more content
        await page.waitForTimeout(3000);

        // Try to find the odds selector - Action Network often has a "Total" or "Over/Under" dropdown/tab
        const selectHandle = await page.evaluateHandle(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            return selects.find(s => {
                const vals = Array.from(s.options).map(o => o.value.toLowerCase());
                return vals.includes('total') || (vals.includes('spread') && vals.includes('ml'));
            });
        });

        if (selectHandle && await selectHandle.asElement()) {
            try {
                await selectHandle.asElement().selectOption('total');
                await page.waitForTimeout(2000);
            } catch (e) {
                console.log('Could not select "total" option from dropdown');
            }
        } else {
            // Try clicking a button if it's a tab interface
            const totalTab = page.locator('button, div').filter({ hasText: /^Total$/i }).first();
            if (await totalTab.isVisible()) {
                await totalTab.click();
                await page.waitForTimeout(2000);
            }
        }

        async function getOpenLine() {
            return await page.evaluate(() => {
                // Look for "Open" or "Opening" in table rows
                const cells = Array.from(document.querySelectorAll('td, th, div'));
                const openCell = cells.find(c => c.innerText.trim() === 'Open' || c.innerText.trim() === 'Opening');
                if (!openCell) {
                    // Fallback: look for the first odds row that seems to be the opening line
                    const rows = Array.from(document.querySelectorAll('tr'));
                    const openingRow = rows.find(r => r.innerText.includes('Open'));
                    if (openingRow) {
                        const rowCells = Array.from(openingRow.querySelectorAll('td')).map(c => c.innerText.trim());
                        if (rowCells.length >= 2) return rowCells.slice(1).join(' / ');
                    }
                    return 'N/A';
                }
                
                // If we found the "Open" cell, look at its siblings or the row it's in
                const row = openCell.closest('tr');
                if (row) {
                    const rowCells = Array.from(row.querySelectorAll('td')).map(c => c.innerText.trim());
                    // Filter out the "Open" text itself
                    const odds = rowCells.filter(text => text !== 'Open' && text !== 'Opening' && text.length > 0);
                    if (odds.length >= 2) return `${odds[0]} / ${odds[1]}`;
                    if (odds.length === 1) return odds[0];
                }
                return 'N/A';
            });
        }

        // 2. Get Full Game
        const fullGameOpenOU = await getOpenLine();

        // 3. Click F5 / 1st 5 Innings
        const f5Selectors = ['F5', '1st 5', '1st 5 Innings', 'First 5'];
        let f5Btn = null;
        for (const selector of f5Selectors) {
            const btn = page.locator('button, .period-selector__item, div').filter({ hasText: new RegExp(`^${selector}$`, 'i') }).first();
            if (await btn.isVisible()) {
                f5Btn = btn;
                break;
            }
        }

        let f5OpenOU = 'N/A';
        if (f5Btn) {
            await f5Btn.click();
            await page.waitForTimeout(2000);
            f5OpenOU = await getOpenLine();
        }

        // 4. Get Team Names
        const teams = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            if (h1) {
                const text = h1.innerText;
                const vsIndex = text.indexOf(' vs. ');
                if (vsIndex !== -1) {
                    const away = text.substring(0, vsIndex).trim();
                    const rest = text.substring(vsIndex + 5);
                    const home = rest.split(/ Odds| Betting| - /)[0].trim();
                    return { away, home };
                }
            }
            // Fallback for team names
            const teamNames = Array.from(document.querySelectorAll('.game-info__team-name')).map(el => el.innerText.trim());
            if (teamNames.length >= 2) return { away: teamNames[0], home: teamNames[1] };
            
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
        await context.close();
    }
}

async function scrapeMLB() {
    console.log('Launching browser with stealth...');
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Critical for Docker/Render
    });
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();
        
        console.log('Fetching game links from Action Network...');
        await page.goto('https://www.actionnetwork.com/mlb/odds', { waitUntil: 'networkidle', timeout: 60000 });
        
        // Wait for games to appear
        await page.waitForSelector('a[href*="/mlb-game/"]', { timeout: 15000 }).catch(() => console.log('Timeout waiting for game links'));

        const gameLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href.includes('/mlb-game/'));
        });
        
        const uniqueLinks = [...new Set(gameLinks)];
        console.log(`Found ${uniqueLinks.length} games. Starting detailed scrape...`);
        
        const results = [];
        // Process all games sequentially on Render to save memory (512MB limit)
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

module.exports = { scrapeMLB };
