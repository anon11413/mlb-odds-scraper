# MLB Odds Scraper Documentation
**Date:** April 23, 2026

## Overview
This script is a robust Playwright-based scraper designed to run in a Termux environment. It extracts MLB Over/Under (O/U) totals from Action Network for both the Full Game and First 5 Innings (F5) periods.

## How It Works
The scraper follows a specific sequence for each game:
1. **Navigates** to the individual game's odds page.
2. **Locates** the "Odds Comparison" section.
3. **Market Selection:** It ensures the market dropdown is set to "over/under" (Total).
4. **Data Extraction (Full Game):** It scrapes the "Open" row from the comparison table to get the starting line (e.g., `o9 u9`).
5. **Period Switch:** It programmatically clicks the "F5" tab.
6. **Data Extraction (F5):** It waits for the table to refresh and scrapes the new "Open" row for the First 5 Innings (e.g., `o4.5 u4.5`).
7. **Team Identification:** It parses the away and home team names directly from the page's main header (`H1`).
8. **Data Push:** It bundles the results and sends them to the configured Render server.

## Features
- **Stealth Mode:** Uses `puppeteer-extra-plugin-stealth` and custom User-Agents to avoid bot detection.
- **Resource Management:** Configured for low-memory mobile environments (Termux) with flags like `--disable-dev-shm-usage` and `--disable-gpu`.
- **Keep-Alive:** Includes a heartbeat mechanism that pings the Render URL every 10 minutes to prevent the Free Tier server from sleeping.
- **Persistence:** Hardcoded credentials ensure "plug-and-play" functionality.

## How to Run
To initiate a full scrape of all current MLB games and push the data to the site:

```bash
cd mlb-odds-scraper
node -e "Object.defineProperty(process, 'platform', { value: 'linux' }); require('./scraper.js').runLocalScraper();"
```

## Configuration
The following values are hardcoded for immediate use:
- **RENDER_URL:** `https://mlb-odds-scraper.onrender.com`
- **API_KEY:** `my_mlb_secret_777`

## Technical Fixes Applied
- **Fixed "Undefined" Teams:** Switched from unreliable CSS class selectors to robust H1 regex parsing.
- **Fixed Identical Totals:** Resolved an issue where the scraper didn't wait for the DOM to update after clicking the F5 tab.
- **Improved Scoping:** Scoped all table interactions to the specific "Odds Comparison" container to avoid picking up player prop data.
