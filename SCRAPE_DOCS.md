# Scraping MLB Data on Termux

This guide documents the process of running an automated web scraper on Android via Termux using Playwright and Chromium.

## Prerequisites

1.  **Termux Setup:** Ensure you have Termux installed and updated.
2.  **X11/GUI Support:** Playwright's Chromium requires a functional display environment. Install the necessary packages:
    ```bash
    pkg install x11-repo
    pkg install chromium
    ```
    *Note: You may need a VNC viewer (like VNC Viewer from the Play Store) to view the GUI if you run the browser in headful mode, but this setup uses headless mode.*
3.  **Node.js:** Ensure Node.js is installed.
    ```bash
    pkg install nodejs
    ```

## Scraping Process

The scraper uses `playwright-extra` with the `stealth` plugin to bypass anti-bot detections on sites like Action Network.

1.  **Browser Configuration:** The `scraper.js` is configured to use the Termux-installed Chromium binary:
    ```javascript
    executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser'
    ```
2.  **Environment Setup:**
    - `scraper.js` fetches game links from the target URL.
    - It uses `chromium.launch` with specific flags: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, and `--disable-gpu` to operate within Termux's restricted filesystem and sandbox environment.
3.  **Data Flow:**
    - The `scraper.js` runs periodically or on-demand.
    - Once the data is scraped, it is sent via `fetch` (POST request) to the local server (`server.js`).
    - The server acts as an in-memory data store for the scraped odds, serving the data to the browser via the frontend.
