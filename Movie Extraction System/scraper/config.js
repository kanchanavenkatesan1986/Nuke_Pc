const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Base working directories
const BASE_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data');
const TEMP_DIR = path.join(DATA_DIR, 'temp');
const JSON_DIR = path.join(DATA_DIR, 'json');
const IMAGES_DIR = path.join(BASE_DIR, 'images');
const LOGS_DIR = path.join(BASE_DIR, 'logs');

// Configurations loaded from .env
const CONFIG = {
  DEBUG: process.env.DEBUG === 'true',
  HEADLESS: process.env.HEADLESS !== 'false',
  CONCURRENCY: parseInt(process.env.CONCURRENCY, 10) || 2,
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30000,
  RETRY_LIMIT: parseInt(process.env.RETRY_LIMIT, 10) || 3,
  DELAY_MIN: parseInt(process.env.DELAY_MIN, 10) || 1000,
  DELAY_MAX: parseInt(process.env.DELAY_MAX, 10) || 3000,
  DOWNLOAD_IMAGES: process.env.DOWNLOAD_IMAGES !== 'false',
  
  // Paths
  paths: {
    BASE_DIR,
    DATA_DIR,
    TEMP_DIR,
    JSON_DIR,
    IMAGES_DIR,
    LOGS_DIR,
    sourcesJson: path.join(BASE_DIR, 'sources.json'),
    movieUrlsJson: path.join(TEMP_DIR, 'movie_urls.json'),
    duplicateMoviesJson: path.join(LOGS_DIR, 'duplicate_movies.json'),
    missingFieldsJson: path.join(LOGS_DIR, 'missing_fields.json'),
    failedMoviesJson: path.join(LOGS_DIR, 'failed_movies.json')
  }
};

/**
 * Initializes all the required folders if they do not exist
 */
function initDirs() {
  const dirs = [
    DATA_DIR,
    TEMP_DIR,
    JSON_DIR,
    IMAGES_DIR,
    LOGS_DIR
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      if (CONFIG.DEBUG) {
        console.log(`[INIT] Created directory: ${dir}`);
      }
    }
  });
}

module.exports = {
  CONFIG,
  initDirs
};
