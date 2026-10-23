const fs = require('fs');
const path = require('path');
const { CONFIG, initDirs } = require('./config');
const { launchBrowser, createPage, closeBrowser } = require('./browser');
const { collectUrls } = require('./collect_urls');
const { extractDetails } = require('./extract_details');
const { extractLinks } = require('./extract_links');
const { downloadImage } = require('./download_images');
const IdGenerator = require('./generate_id');
const { cleanMovieRecord, checkAndLogMissingFields, logDuplicate } = require('./clean_data');
const { exportJsonAndSql } = require('./export_json');

// Helper sleep delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('==================================================');
  console.log('         TVK MOVIES DATA EXTRACTOR STARTING       ');
  console.log('==================================================');

  // Initialize folders
  initDirs();

  let browser;
  try {
    // Launch Playwright browser
    browser = await launchBrowser();
    
    // Step 1: Collect movie URLs (handles pagination)
    await collectUrls(browser);

    // Read the collected movie URLs from data/temp/movie_urls.json
    if (!fs.existsSync(CONFIG.paths.movieUrlsJson)) {
      throw new Error(`Movie URLs file not found at ${CONFIG.paths.movieUrlsJson}`);
    }
    const movieUrlsQueue = JSON.parse(fs.readFileSync(CONFIG.paths.movieUrlsJson, 'utf8'));
    console.log(`\n[START] Found ${movieUrlsQueue.length} movie URLs in queue to extract.`);

    // Load existing movies for resume support
    let finalMoviesList = [];
    if (fs.existsSync(CONFIG.paths.JSON_DIR)) {
      const files = fs.readdirSync(CONFIG.paths.JSON_DIR);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          try {
            const parts = file.replace('.json', '').split('-');
            const sCat = parts[0];
            const sYear = parts[1];
            
            const data = JSON.parse(fs.readFileSync(path.join(CONFIG.paths.JSON_DIR, file), 'utf8'));
            if (Array.isArray(data)) {
              const mappedData = data.map(m => ({
                ...m,
                sourceCategory: sCat,
                sourceYear: sYear
              }));
              finalMoviesList = finalMoviesList.concat(mappedData);
            }
          } catch (e) {
            console.error(`[START] Error reading existing file ${file}:`, e.message);
          }
        }
      });
    }
    console.log(`[START] Loaded ${finalMoviesList.length} existing movies for resume support.`);

    // Initialize ID generator with existing movies
    const idGenerator = new IdGenerator();
    idGenerator.initializeFromExisting(finalMoviesList);

    // Initialize tracking counters for progress display
    let completedCount = finalMoviesList.length;
    let failedCount = 0;
    let duplicateCount = 0;
    
    // Read duplicate log size on startup
    if (fs.existsSync(CONFIG.paths.duplicateMoviesJson)) {
      try {
        duplicateCount = JSON.parse(fs.readFileSync(CONFIG.paths.duplicateMoviesJson, 'utf8')).length;
      } catch (_) {}
    }

    let missingFieldsCount = 0;
    if (fs.existsSync(CONFIG.paths.missingFieldsJson)) {
      try {
        missingFieldsCount = JSON.parse(fs.readFileSync(CONFIG.paths.missingFieldsJson, 'utf8')).length;
      } catch (_) {}
    }

    const detailPage = await createPage(browser);

    // Process each movie URL in the queue
    for (let i = 0; i < movieUrlsQueue.length; i++) {
      const item = movieUrlsQueue[i];
      const { category, year, url, title: queueTitle } = item;

      // Check if movie already exists in our dataset (Resume Support)
      const existingMovie = finalMoviesList.find(m => m.p360 === url || m.p720 === url || m.p1080 === url || (m.title && m.title.toLowerCase() === queueTitle.toLowerCase() && m.year === year && m.category === category) || m.id?.includes(`${category}-${year}`));
      // Let's check exactly if we have already scraped this exact URL
      const isAlreadyScraped = finalMoviesList.some(m => {
        // Match by title + category + year, or check if it matches in the URLs we recorded.
        // We can check if any field contains this detail page URL or if we tracked it.
        // A direct match is checking if the title matches or if it's already in the final JSON.
        return m.title && m.title.toLowerCase() === queueTitle.toLowerCase() && m.year === year;
      });

      if (isAlreadyScraped) {
        if (CONFIG.DEBUG) {
          console.log(`[RESUME] Skipping already scraped movie: ${queueTitle} (${category} - ${year})`);
        }
        continue;
      }

      console.log(`\n--------------------------------------------------`);
      console.log(`[PROGRESS] Movie ${i + 1}/${movieUrlsQueue.length}`);
      console.log(`[PROGRESS] Category: ${category.toUpperCase()} | Year: ${year}`);
      console.log(`[PROGRESS] Movie Title: ${queueTitle}`);
      console.log(`[PROGRESS] Fetching URL: ${url}`);
      console.log(`--------------------------------------------------`);

      let rawDetails = null;
      let downloadLinks = null;
      let attempts = 0;
      let success = false;

      while (attempts < CONFIG.RETRY_LIMIT && !success) {
        try {
          attempts++;
          
          // Visit detail page
          await detailPage.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.REQUEST_TIMEOUT });
          const html = await detailPage.content();
          
          // Extract details
          rawDetails = extractDetails(html, url, category, year);
          
          // Fallback title from queue if not parsed
          if (!rawDetails.title) {
            rawDetails.title = queueTitle;
          }

          // Extract download links and duration
          downloadLinks = await extractLinks(detailPage, url);
          
          success = true;
        } catch (err) {
          console.error(`[ERROR] Attempt ${attempts} failed for ${queueTitle}: ${err.message}`);
          if (attempts >= CONFIG.RETRY_LIMIT) {
            failedCount++;
            logFailedMovie({
              title: queueTitle,
              url,
              error: err.message
            });
          } else {
            await delay(2000 * attempts);
          }
        }
      }

      if (!success || !rawDetails) {
        console.log(`[PROGRESS] Status: FAILED | Completed: ${completedCount} | Failed: ${failedCount}`);
        continue;
      }

      // Merge duration from download links if detail page didn't have it
      if (downloadLinks && downloadLinks.duration && !rawDetails.duration) {
        rawDetails.duration = downloadLinks.duration;
      }

      // Check duplicates
      const isDuplicate = finalMoviesList.find(m => {
        return m.title.toLowerCase() === rawDetails.title.toLowerCase() ||
               (m.p360 && m.p360 === downloadLinks.p360 && m.p360 !== '') ||
               (m.p720 && m.p720 === downloadLinks.p720 && m.p720 !== '') ||
               (m.p1080 && m.p1080 === downloadLinks.p1080 && m.p1080 !== '');
      });

      if (isDuplicate) {
        duplicateCount++;
        console.log(`[DUPLICATE] Detected duplicate for movie: ${rawDetails.title}. Logging...`);
        logDuplicate({ title: rawDetails.title, url }, isDuplicate.id);
        console.log(`[PROGRESS] Status: DUPLICATE | Completed: ${completedCount} | Duplicates: ${duplicateCount}`);
        continue;
      }

      // Download Poster image
      let localImageFilename = '';
      if (rawDetails.poster) {
        try {
          localImageFilename = await downloadImage(rawDetails.poster, rawDetails.title, category, year);
        } catch (imgErr) {
          console.error(`[IMAGE ERROR] Image download failed: ${imgErr.message}`);
        }
      }

      // Generate next sequence ID
      const newId = idGenerator.generateId(category, year);

      // Construct movie record
      const movieRecord = cleanMovieRecord({
        ...rawDetails,
        id: newId,
        image: localImageFilename,
        p360: downloadLinks ? downloadLinks.p360 : '',
        p720: downloadLinks ? downloadLinks.p720 : '',
        p1080: downloadLinks ? downloadLinks.p1080 : '',
        sourceCategory: category,
        sourceYear: year
      });

      // Log missing fields
      checkAndLogMissingFields(movieRecord);
      
      // Update missing fields count
      if (fs.existsSync(CONFIG.paths.missingFieldsJson)) {
        try {
          missingFieldsCount = JSON.parse(fs.readFileSync(CONFIG.paths.missingFieldsJson, 'utf8')).length;
        } catch (_) {}
      }

      // Push to final list
      finalMoviesList.push(movieRecord);
      completedCount++;

      // Export json and sql updates immediately for progress persistence
      exportJsonAndSql(finalMoviesList);

      if (CONFIG.DEBUG) {
        console.log(`[PROGRESS] Status: SUCCESS`);
        console.log(`[PROGRESS] ID: ${newId}`);
        console.log(`[PROGRESS] Completed: ${completedCount} | Failed: ${failedCount} | Missing: ${missingFieldsCount} | Duplicates: ${duplicateCount}`);
      }

      // Respectful throttling delay
      const throttleDelay = Math.floor(Math.random() * (CONFIG.DELAY_MAX - CONFIG.DELAY_MIN + 1)) + CONFIG.DELAY_MIN;
      await delay(throttleDelay);
    }

    console.log('\n==================================================');
    console.log('             EXTRACTION LIFECYCLE COMPLETED        ');
    console.log(`  Total Successful: ${completedCount}`);
    console.log(`  Total Failed:     ${failedCount}`);
    console.log(`  Total Duplicates: ${duplicateCount}`);
    console.log(`  Total Missing:    ${missingFieldsCount}`);
    console.log('==================================================');

  } catch (error) {
    console.error('[FATAL ERROR] Scraper crashed:', error);
  } finally {
    if (browser) {
      await closeBrowser();
    }
    process.exit(0);
  }
}

/**
 * Helper to log a failed movie extraction
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

main();
