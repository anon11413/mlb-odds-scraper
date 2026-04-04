# MLB Odds Scraper - Setup & Deployment

This project has been split into two parts:
1. **Server (Render):** A lightweight dashboard that receives and displays data.
2. **Scraper (Local):** A script that runs on your local machine to scrape Action Network and push data to the server.

## 1. Server Setup (Render)

1. Go to your **Render Dashboard**.
2. Select your Web Service.
3. Go to **Environment**.
4. Add the following Environment Variable:
   - `SCRAPER_API_KEY`: A secret password of your choice (e.g., `my_super_secret_123`).
5. Render will automatically redeploy since you just pushed to GitHub.

## 2. Local Scraper Setup (Your Computer)

You need to run the scraper locally because Render's IP addresses are often blocked by Action Network.

### Prerequisites
- Node.js installed.
- Playwright dependencies installed.

### Installation
In your local project folder, run:
```bash
npm install
npx playwright install chromium
```

### Running the Scraper
Run the following commands in your terminal (replace with your actual URL and API Key):

**Mac/Linux:**
```bash
export RENDER_URL="https://your-app-name.onrender.com"
export SCRAPER_API_KEY="your-secret-key-from-render"
node scraper.js
```

**Windows (Command Prompt):**
```bash
set RENDER_URL=https://your-app-name.onrender.com
set SCRAPER_API_KEY=your-secret-key-from-render
node scraper.js
```

**Windows (PowerShell):**
```bash
$env:RENDER_URL="https://your-app-name.onrender.com"
$env:SCRAPER_API_KEY="your-secret-key-from-render"
node scraper.js
```

## 3. Automation
To keep it running in the background, use `pm2`:
```bash
npm install -g pm2
pm2 start scraper.js --name mlb-scraper
```
This ensures the scraper stays active even if you close your terminal.
