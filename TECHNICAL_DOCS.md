# MLB Scraper: Technical Documentation

This document details the automated workflow for scraping MLB odds data and synchronizing it with a centralized server.

## Overview
The system consists of two parts:
1. **Local Scraper (Termux):** A headless browser automation script that extracts real-time betting data.
2. **Centralized Server (Render):** A web application that receives, stores, and serves the latest odds via an API.

---

## 1. Local Scraper (Termux)

### Prerequisites
* **Environment:** Android device running Termux.
* **Browsing Engine:** Chromium (installed via `pkg install chromium`).
* **Automation Tools:** `playwright` and `playwright-extra` with the `stealth` plugin to evade anti-bot security.

### Scraping Workflow
1. **Stealth Launch:** The scraper launches a headless Chromium instance with specific security-bypass flags:
   - `--no-sandbox`
   - `--disable-setuid-sandbox`
   - `--disable-dev-shm-usage`
   - `--disable-gpu`
2. **Game Discovery:** The script fetches the list of active games from the target source (Action Network) by locating game-specific URL patterns.
3. **Extraction:**
   - For each game, it navigates to the URL and waits for the DOM content.
   - It simulates user interactions (e.g., clicking "Total" or "1st 5 Innings" tabs) to ensure the required odds data is rendered.
   - It performs custom DOM evaluation to extract team names and opening line odds.
4. **Data Transmission:** The collected data is aggregated into an array and sent via a `POST` request to the server's `/api/odds` endpoint.

---

## 2. Centralized Server (Render)

### Functionality
* **Hosting:** Deployed on Render.
* **API Endpoints:**
    - `POST /api/odds`: Receives the JSON payload containing the game data from the local scraper.
    - `GET /api/odds`: Provides the most recent scraped data for the frontend to display.
* **Data Storage:** Operates an in-memory cache (`cachedData`), ensuring high-speed access without the need for a database.

---

## 3. Deployment & Security

### Security Configuration
* **Endpoint Protection:** The `/api/odds` endpoint requires a shared `SCRAPER_API_KEY` to ensure only authorized data sources can push updates to the server.
* **Environment Variables:** Credentials and server URLs are managed via `.env` files to keep secrets out of the codebase.

### Render Deployment Notes
* **Build Command:** Configured as `npm install` in the Render dashboard to avoid permission errors during browser installation.
* **Dependencies:** The server uses `express` for the API and `dotenv` for configuration management.

---

## 4. Operational Workflow
1. **Initiate:** The local scraper runs, either manually or via a scheduled interval (e.g., `setInterval` in `scraper.js`).
2. **Transfer:** The local scraper automatically pushes updated JSON data to the Render server.
3. **Access:** The server validates the API key, updates its internal cache, and updates the `lastScrapedTime`. The data is then immediately available for public view.
