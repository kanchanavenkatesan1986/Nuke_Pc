const fs = require('fs');
const cheerio = require('cheerio');
const { CONFIG } = require('./config');
const { createPage } = require('./browser');

/**
 * Helper delay function
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Collects all movie URLs for each source listed in sources.json
 * @param {Browser} browser 
 */
async function collectUrls(browser) {
  if (CONFIG.DEBUG) {
    console.log('\n[STEP 1] Starting Movie URL Collection...');
  }

  // Load sources.json
  if (!fs.existsSync(CONFIG.paths.sourcesJson)) {
    throw new Error(`sources.json not found at ${CONFIG.paths.sourcesJson}`);
  }
  
  const sources = JSON.parse(fs.readFileSync(CONFIG.paths.sourcesJson, 'utf8'));
  const page = await createPage(browser);
  
  let allMovieUrls = [];
  
  // If temp file already exists, let's load it for potential merging/logging
  if (fs.existsSync(CONFIG.paths.movieUrlsJson)) {
    try {
      allMovieUrls = JSON.parse(fs.readFileSync(CONFIG.paths.movieUrlsJson, 'utf8'));
      if (CONFIG.DEBUG) {
        console.log(`[STEP 1] Loaded ${allMovieUrls.length} existing movie URLs from temp file.`);
      }
    } catch (e) {
      allMovieUrls = [];
    }
  }

  for (const source of sources) {
    const { category, year, url } = source;
    if (CONFIG.DEBUG) {
      console.log(`\n[STEP 1] Processing source: category=${category}, year=${year}, url=${url}`);
    }

    let currentPageNum = 1;
    let totalPages = 1;
    let hasMorePages = true;

    while (hasMorePages && currentPageNum <= totalPages) {
      let pageUrl = url;
      if (currentPageNum > 1) {
        // Construct pagination URL: append or modify query string ?get-page=X
        const urlObj = new URL(url);
        urlObj.searchParams.set('get-page', currentPageNum);
        pageUrl = urlObj.href;
      }

      if (CONFIG.DEBUG) {
        console.log(`[STEP 1] Fetching page ${currentPageNum}/${totalPages || '?'}: ${pageUrl}`);
      }

      let html = '';
      let attempts = 0;
      let success = false;

      while (attempts < CONFIG.RETRY_LIMIT && !success) {
        try {
          attempts++;
          await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.REQUEST_TIMEOUT });
          html = await page.content();
          success = true;
        } catch (err) {
          console.error(`[STEP 1] Attempt ${attempts} failed for ${pageUrl}: ${err.message}`);
          if (attempts >= CONFIG.RETRY_LIMIT) {
            // Log to failed movies
            logFailedMovie({
              title: `Category: ${category} Year: ${year} Page: ${currentPageNum}`,
              url: pageUrl,
              error: err.message
            });
          } else {
            const retryDelay = 2000 * attempts;
            await delay(retryDelay);
          }
        }
      }

      if (!success) {
        currentPageNum++;
        continue;
      }

      // Parse HTML with Cheerio
      const $ = cheerio.load(html);

      // Determine total pages on page 1
      if (currentPageNum === 1) {
        // Try to find pagination text like "Showing Page 1 of 7" or similar
        const pagesInfoText = $('.pages-info').text() || $('.pages').text();
        const match = pagesInfoText.match(/of\s+(\d+)/i);
        if (match) {
          totalPages = parseInt(match[1], 10);
        } else {
          // Fallback: Check links in pagination container
          let maxPage = 1;
          $('.pagination-container a, .pagination a').each((_, elem) => {
            const pageText = $(elem).text().trim();
            const pageNum = parseInt(pageText, 10);
            if (!isNaN(pageNum) && pageNum > maxPage) {
              maxPage = pageNum;
            }
          });
          totalPages = maxPage;
        }
        if (CONFIG.DEBUG) {
          console.log(`[STEP 1] Detected total pages: ${totalPages}`);
        }
      }

      // Extract movies
      // The movies are listed under <div class="folder"> or .folder class
      let moviesFound = 0;
      $('.folder').each((_, elem) => {
        const link = $(elem).find('a');
        if (link.length > 0) {
          const title = link.text().trim();
          const href = link.attr('href');
          if (href && href.includes('/movie/')) {
            const movieUrl = new URL(href, url).href;
            
            // Avoid adding duplicates to the temp url collector
            const isDup = allMovieUrls.some(m => m.url === movieUrl);
            if (!isDup) {
              allMovieUrls.push({
                category,
                year,
                title,
                url: movieUrl
              });
              moviesFound++;
            }
          }
        }
      });

      if (CONFIG.DEBUG) {
        console.log(`[STEP 1] Extracted ${moviesFound} movies from page ${currentPageNum}`);
      }

      // Random delay to avoid bot detection
      const delayTime = Math.floor(Math.random() * (CONFIG.DELAY_MAX - CONFIG.DELAY_MIN + 1)) + CONFIG.DELAY_MIN;
      await delay(delayTime);

      currentPageNum++;
    }
  }

  // Save gathered URLs to temp file
  fs.writeFileSync(CONFIG.paths.movieUrlsJson, JSON.stringify(allMovieUrls, null, 2), 'utf8');
  if (CONFIG.DEBUG) {
    console.log(`[STEP 1] Movie URL collection completed. Total movies collected: ${allMovieUrls.length}`);
  }
}

/**
 * Logs a failed page fetch to failed_movies.json
 */
function logFailedMovie({ title, url, error }) {
  let failed = [];
  if (fs.existsSync(CONFIG.paths.failedMoviesJson)) {
    try {
      failed = JSON.parse(fs.readFileSync(CONFIG.paths.failedMoviesJson, 'utf8'));
    } catch (e) {
      failed = [];
    }
  }
  
  failed.push({
    title,
    url,
    error,
    date: new Date().toISOString().split('T')[0]
  });
  
  fs.writeFileSync(CONFIG.paths.failedMoviesJson, JSON.stringify(failed, null, 2), 'utf8');
}

module.exports = {
  collectUrls
};
