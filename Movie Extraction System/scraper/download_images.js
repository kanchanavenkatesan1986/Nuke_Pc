const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { CONFIG } = require('./config');

/**
 * Cleans a movie title of characters invalid for OS filenames
 * @param {string} title Movie title
 * @returns {string} Cleaned filename
 */
function cleanFilename(title) {
  if (!title) return 'unknown';
  // Remove invalid OS characters: < > : " / \ | ? *
  return title.replace(/[<>:"/\\|?*]/g, '').trim();
}

/**
 * Downloads a movie poster image and saves it to category/year folder
 * @param {string} imageUrl URL of the poster image
 * @param {string} title Movie title
 * @param {string} category Movie category (e.g. tamil)
 * @param {string} year Movie year (e.g. 2026)
 * @returns {Promise<string>} Saved image filename (without full path) or empty string on failure
 */
async function downloadImage(imageUrl, title, category, year) {
  if (!imageUrl || !CONFIG.DOWNLOAD_IMAGES) {
    return '';
  }

  const cleanedTitle = cleanFilename(title);
  
  // Extract extension or default to .jpg
  let ext = '.jpg';
  try {
    const urlPath = new URL(imageUrl).pathname;
    const parsedExt = path.extname(urlPath);
    if (parsedExt && parsedExt.match(/^\.(jpg|jpeg|png|webp|gif)/i)) {
      ext = parsedExt.toLowerCase();
    }
  } catch (e) {
    // Keep default .jpg
  }

  const filename = `${cleanedTitle}${ext}`;
  const targetDir = path.join(CONFIG.paths.IMAGES_DIR, category.toLowerCase(), year.toString());
  const targetPath = path.join(targetDir, filename);

  // If file already exists, return the filename immediately (resume support)
  if (fs.existsSync(targetPath)) {
    if (CONFIG.DEBUG) {
      console.log(`[IMAGE] Image already exists: ${filename}`);
    }
    return filename;
  }

  // Create directory if not exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (CONFIG.DEBUG) {
    console.log(`[IMAGE] Downloading poster to: ${targetPath}`);
  }

  let attempts = 0;
  while (attempts < CONFIG.RETRY_LIMIT) {
    try {
      attempts++;
      const response = await axios({
        url: imageUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: CONFIG.REQUEST_TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://isaidub.ceo/'
        }
      });

      const writer = fs.createWriteStream(targetPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      return filename;
    } catch (err) {
      if (CONFIG.DEBUG) {
        console.warn(`[IMAGE] Attempt ${attempts} failed to download ${imageUrl}: ${err.message}`);
      }
      
      // Delete partially written file if it exists
      if (fs.existsSync(targetPath)) {
        try { fs.unlinkSync(targetPath); } catch (_) {}
      }

      if (attempts >= CONFIG.RETRY_LIMIT) {
        if (CONFIG.DEBUG) {
          console.error(`[IMAGE] Failed to download image after ${CONFIG.RETRY_LIMIT} attempts.`);
        }
        return '';
      }
      
      // Delay before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }

  return '';
}

module.exports = {
  downloadImage,
  cleanFilename
};
