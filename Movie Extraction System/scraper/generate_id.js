const { CONFIG } = require('./config');

class IdGenerator {
  constructor() {
    this.counters = {};
  }

  /**
   * Initializes the ID generator with existing movies to prevent duplication or regression when resuming
   * @param {Array} existingMovies List of already crawled movie objects
   */
  initializeFromExisting(existingMovies) {
    if (!Array.isArray(existingMovies)) return;
    
    existingMovies.forEach(movie => {
      if (movie.id && movie.category && movie.year) {
        const parts = movie.id.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        
        if (!isNaN(num)) {
          const key = `${movie.category.toLowerCase()}-${movie.year}`;
          if (!this.counters[key] || num > this.counters[key]) {
            this.counters[key] = num;
          }
        }
      }
    });

    if (CONFIG.DEBUG) {
      console.log('[ID GEN] Counters initialized:', this.counters);
    }
  }

  /**
   * Generates the next sequential ID for a given category and year
   * @param {string} category Movie category (e.g. tamil)
   * @param {string} year Movie year (e.g. 2026)
   * @returns {string} Unique movie ID (e.g. tamil-2026-00001)
   */
  generateId(category, year) {
    const key = `${category.toLowerCase()}-${year}`;
    
    if (!this.counters[key]) {
      this.counters[key] = 0;
    }
    
    this.counters[key]++;
    const padNum = String(this.counters[key]).padStart(5, '0');
    return `${key}-${padNum}`;
  }
}

module.exports = IdGenerator;
