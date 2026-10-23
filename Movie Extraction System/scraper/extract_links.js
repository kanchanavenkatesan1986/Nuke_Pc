const cheerio = require('cheerio');
const { CONFIG } = require('./config');

/**
 * Helper delay function
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Follows a link from the quality folder down to the final download link
 * @param {Page} page Playwright Page
 * @param {string} qualityFolderUrl Quality folder page URL
 * @param {object} results Reference to results object to populate duration
 * @returns {Promise<string>} Final download URL
 */
async function followToFinalDownloadLink(page, qualityFolderUrl, results) {
  let currentUrl = qualityFolderUrl;
  let attempts = 0;
  
  if (CONFIG.DEBUG) {
    console.log(`[LINKS] Following quality folder: ${qualityFolderUrl}`);
  }

  try {
    // --- STEP 1: Visit Quality Folder Page ---
    await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.REQUEST_TIMEOUT });
    let html = await page.content();
    let $ = cheerio.load(html);
    
    // Find the file details link (usually containing /download/page/ or in .coral class)
    let fileDetailsUrl = '';
    $('a').each((_, elem) => {
      const href = $(elem).attr('href') || '';
      if (href.includes('/download/page/')) {
        fileDetailsUrl = new URL(href, currentUrl).href;
        return false; // break
      }
    });

    if (!fileDetailsUrl) {
      // Fallback: look for any .coral link
      const coralHref = $('.coral').attr('href');
      if (coralHref) {
        fileDetailsUrl = new URL(coralHref, currentUrl).href;
      }
    }

    if (!fileDetailsUrl) {
      if (CONFIG.DEBUG) console.log(`[LINKS] Could not find file details link on ${currentUrl}`);
      return '';
    }

    currentUrl = fileDetailsUrl;
    if (CONFIG.DEBUG) console.log(`[LINKS] -> File details URL: ${currentUrl}`);
    await delay(1000);

    // --- STEP 2: Visit File Details Page ---
    await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.REQUEST_TIMEOUT });
    html = await page.content();
    $ = cheerio.load(html);

    // Extract duration from this page if available
    $('.details').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.toLowerCase().includes('duration:')) {
        results.duration = text.replace(/duration:/i, '').trim();
      }
    });

    // Find the server page link (e.g. dubpage.xyz/download/view/)
    let serverPageUrl = '';
    $('a').each((_, elem) => {
      const href = $(elem).attr('href') || '';
      if (href.includes('/download/view/') || href.includes('dubpage.xyz')) {
        serverPageUrl = href;
        return false; // break
      }
    });

    // Fallback: look inside .dlink or .download
    if (!serverPageUrl) {
      const dlinkHref = $('.dlink a, .download a').first().attr('href');
      if (dlinkHref) {
        serverPageUrl = dlinkHref;
      }
    }

    if (!serverPageUrl) {
      if (CONFIG.DEBUG) console.log(`[LINKS] Could not find server link on ${currentUrl}`);
      return currentUrl; // Fallback to current level
    }

    // Resolve if relative, though usually absolute (dubpage.xyz)
    if (serverPageUrl.startsWith('/')) {
      serverPageUrl = new URL(serverPageUrl, currentUrl).href;
    }

    currentUrl = serverPageUrl;
    if (CONFIG.DEBUG) console.log(`[LINKS] -> Server Page URL: ${currentUrl}`);
    await delay(1000);

    // --- STEP 3: Visit Server Page (dubpage.xyz/download/view/ID) ---
    await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.REQUEST_TIMEOUT });
    html = await page.content();
    $ = cheerio.load(html);

    // Find the redirect page link (e.g. dubmv.xyz/download/file/)
    let redirectPageUrl = '';
    $('a').each((_, elem) => {
      const href = $(elem).attr('href') || '';
      if (href.includes('/download/file/') || href.includes('dubmv.xyz')) {
        redirectPageUrl = href;
        return false; // break
      }
    });

    if (!redirectPageUrl) {
      // Fallback to first .dlink link
      const dlinkHref = $('.dlink a').first().attr('href');
      if (dlinkHref) {
        redirectPageUrl = dlinkHref;
      }
    }

    if (!redirectPageUrl) {
      if (CONFIG.DEBUG) console.log(`[LINKS] Could not find redirect page on ${currentUrl}`);
      return currentUrl;
    }

    if (redirectPageUrl.startsWith('/')) {
      redirectPageUrl = new URL(redirectPageUrl, currentUrl).href;
    }

    currentUrl = redirectPageUrl;
    if (CONFIG.DEBUG) console.log(`[LINKS] -> Redirect Page URL: ${currentUrl}`);
    await delay(1000);

    // --- STEP 4: Visit Redirect Page (dubmv.xyz/download/file/ID) ---
    await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.REQUEST_TIMEOUT });
    html = await page.content();
    $ = cheerio.load(html);

    // Find the final direct download link (download.isaidub.dad/download.php?url=...)
    let finalDownloadUrl = '';
    $('a').each((_, elem) => {
      const href = $(elem).attr('href') || '';
      if (href.includes('download.php') || href.includes('dubshare.one')) {
        finalDownloadUrl = href;
        return false; // break
      }
    });

    if (!finalDownloadUrl) {
      // Try first link inside .dlink
      const firstDlink = $('.dlink a').first().attr('href');
      if (firstDlink) {
        finalDownloadUrl = firstDlink;
      }
    }

    if (finalDownloadUrl) {
      if (CONFIG.DEBUG) console.log(`[LINKS] -> Final Download URL: ${finalDownloadUrl}`);
      return finalDownloadUrl;
    } else {
      if (CONFIG.DEBUG) console.log(`[LINKS] -> Using last redirect URL: ${currentUrl}`);
      return currentUrl;
    }

  } catch (err) {
    if (CONFIG.DEBUG) {
      console.error(`[LINKS] Error following download path: ${err.message}`);
    }
    // Return the furthest page we reached instead of failing completely
    return currentUrl;
  }
}

/**
 * Extracts and categorizes links from a movie details page
 * @param {Page} page Playwright Page
 * @param {string} movieUrl URL of the movie details page
 * @returns {Promise<object>} Extracted download links and duration
 */
async function extractLinks(page, movieUrl) {
  const results = {
    p360: '',
    p720: '',
    p1080: '',
    duration: ''
  };

  try {
    if (CONFIG.DEBUG) {
      console.log(`[LINKS] Checking subfolders for: ${movieUrl}`);
    }

    await page.goto(movieUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.REQUEST_TIMEOUT });
    let html = await page.content();
    let $ = cheerio.load(html);

    // Check if there are folder links inside the movie detail page
    const subfolders = [];
    $('.folder a').each((_, elem) => {
      const href = $(elem).attr('href') || '';
      if (href.includes('/movie/')) {
        subfolders.push(new URL(href, movieUrl).href);
      }
    });

    if (subfolders.length === 0) {
      if (CONFIG.DEBUG) {
        console.log(`[LINKS] No subfolders found directly on detail page. Using page as its own source.`);
      }
      subfolders.push(movieUrl);
    }

    // Process each edition subfolder
    for (const subfolderUrl of subfolders) {
      if (CONFIG.DEBUG) {
        console.log(`[LINKS] Visiting subfolder: ${subfolderUrl}`);
      }
      
      await page.goto(subfolderUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.REQUEST_TIMEOUT });
      let subHtml = await page.content();
      let $sub = cheerio.load(subHtml);

      // Find the quality folders inside the subfolder page
      const qualityFolders = [];
      $sub('.folder a').each((_, elem) => {
        const text = $sub(elem).text().toLowerCase();
        const href = $sub(elem).attr('href') || '';
        if (href.includes('/movie/')) {
          qualityFolders.push({
            url: new URL(href, subfolderUrl).href,
            text
          });
        }
      });

      // Process quality folders
      for (const qFolder of qualityFolders) {
        let qualityKey = null;
        if (qFolder.text.includes('1080')) {
          qualityKey = 'p1080';
        } else if (qFolder.text.includes('720')) {
          qualityKey = 'p720';
        } else if (qFolder.text.includes('360')) {
          qualityKey = 'p360';
        } else if (qFolder.text.includes('480')) {
          // Fallback to p360 for 480p if p360 isn't set yet
          qualityKey = 'p360';
        }

        if (qualityKey && !results[qualityKey]) {
          const finalUrl = await followToFinalDownloadLink(page, qFolder.url, results);
          if (finalUrl) {
            results[qualityKey] = finalUrl;
          }
          await delay(1000);
        }
      }
    }

  } catch (err) {
    if (CONFIG.DEBUG) {
      console.error(`[LINKS] Error extracting links for ${movieUrl}: ${err.message}`);
    }
  }

  return results;
}

module.exports = {
  extractLinks
};
