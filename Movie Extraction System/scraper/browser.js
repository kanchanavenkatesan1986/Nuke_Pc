const { chromium } = require('playwright');
const { CONFIG } = require('./config');

let browser = null;

/**
 * Launches a Chromium browser instance
 * @returns {Promise<Browser>} Playwright Browser instance
 */
async function launchBrowser() {
  if (browser) return browser;
  
  if (CONFIG.DEBUG) {
    console.log('[BROWSER] Launching Chromium browser...');
  }
  
  browser = await chromium.launch({
    headless: CONFIG.HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
  
  return browser;
}

/**
 * Creates a browser context and a new page with realistic user agents
 * @param {Browser} browserInstance 
 * @returns {Promise<Page>} Playwright Page instance
 */
async function createPage(browserInstance) {
  const context = await browserInstance.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    }
  });
  
  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.REQUEST_TIMEOUT);
  return page;
}

/**
 * Closes the global browser instance
 */
async function closeBrowser() {
  if (browser) {
    if (CONFIG.DEBUG) {
      console.log('[BROWSER] Closing browser...');
    }
    await browser.close();
    browser = null;
  }
}

module.exports = {
  launchBrowser,
  createPage,
  closeBrowser
};
