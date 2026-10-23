const fs = require('fs');
const { CONFIG } = require('./config');

/**
 * Cleans, trims, and normalizes movie fields, ensuring no null/undefined values.
 * @param {object} movie Raw movie details
 * @returns {object} Cleaned movie details
 */
function cleanMovieRecord(movie) {
  return {
    id: movie.id || '',
    title: (movie.title || '').trim(),
    image: (movie.image || '').trim(), // Note: only filename, not URL
    release: (movie.release || '').trim(),
    language: (movie.language || '').trim(),
    year: String(movie.year || '').trim(),
    category: (movie.category || '').trim(),
    duration: (movie.duration || '').trim(),
    director: (movie.director || '').trim(),
    starring: (movie.starring || '').trim(),
    story: (movie.story || '').trim(),
    p360: (movie.p360 || '').trim(),
    p720: (movie.p720 || '').trim(),
    p1080: (movie.p1080 || '').trim(),
    created_at: movie.created_at || new Date().toISOString().split('T')[0],
    sourceCategory: (movie.sourceCategory || '').trim(),
    sourceYear: String(movie.sourceYear || '').trim()
  };
}

/**
 * Checks for missing metadata fields and logs them to logs/missing_fields.json.
 * Does not remove the movie from the final list.
 * @param {object} movie Cleaned movie object
 */
function checkAndLogMissingFields(movie) {
  const missing = [];
  
  if (!movie.director) missing.push('director');
  if (!movie.story) missing.push('story');
  if (!movie.duration) missing.push('duration');
  if (!movie.image) missing.push('image');
  
  // If all quality links are missing
  if (!movie.p360 && !movie.p720 && !movie.p1080) {
    missing.push('download_links');
  }

  if (missing.length > 0) {
    let logs = [];
    if (fs.existsSync(CONFIG.paths.missingFieldsJson)) {
      try {
        logs = JSON.parse(fs.readFileSync(CONFIG.paths.missingFieldsJson, 'utf8'));
      } catch (e) {
        logs = [];
      }
    }

    // Replace if already logged, otherwise push
    const idx = logs.findIndex(log => log.id === movie.id);
    const logItem = {
      id: movie.id,
      title: movie.title,
      missing
    };

    if (idx !== -1) {
      logs[idx] = logItem;
    } else {
      logs.push(logItem);
    }

    fs.writeFileSync(CONFIG.paths.missingFieldsJson, JSON.stringify(logs, null, 2), 'utf8');
  }
}

/**
 * Logs duplicate movie occurrences to logs/duplicate_movies.json
 * @param {object} duplicateMovie Movie object that is a duplicate
 * @param {string} duplicateOfId The ID of the original movie it duplicates
 */
function logDuplicate(duplicateMovie, duplicateOfId) {
  let logs = [];
  if (fs.existsSync(CONFIG.paths.duplicateMoviesJson)) {
    try {
      logs = JSON.parse(fs.readFileSync(CONFIG.paths.duplicateMoviesJson, 'utf8'));
    } catch (e) {
      logs = [];
    }
  }

  // Prevent logging exact duplicates multiple times in the log file
  const isAlreadyLogged = logs.some(log => log.url === duplicateMovie.url);
  if (!isAlreadyLogged) {
    logs.push({
      title: duplicateMovie.title,
      url: duplicateMovie.url,
      duplicate_of: duplicateOfId
    });
    fs.writeFileSync(CONFIG.paths.duplicateMoviesJson, JSON.stringify(logs, null, 2), 'utf8');
  }
}

module.exports = {
  cleanMovieRecord,
  checkAndLogMissingFields,
  logDuplicate
};
