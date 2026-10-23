const fs = require('fs');
const path = require('path');
const { CONFIG } = require('./config');

/**
 * Escapes SQL string values to prevent injection and syntax errors
 * @param {string} val 
 * @returns {string} Escaped SQL string
 */
function escapeSql(val) {
  if (val === null || val === undefined) return '';
  // Replace single quotes with double single quotes for SQLite/D1
  return String(val).replace(/'/g, "''");
}

/**
 * Exports final movie records to category-year JSON and D1 SQL files
 * @param {Array} movies Complete list of movie records
 */
function exportJsonAndSql(movies) {
  if (CONFIG.DEBUG) {
    console.log(`\n[EXPORT] Exporting ${movies.length} movies...`);
  }

  if (!Array.isArray(movies) || movies.length === 0) {
    if (CONFIG.DEBUG) console.log('[EXPORT] No movies to export.');
    return;
  }

  // Group movies by source category and source year
  const groups = {};
  movies.forEach(movie => {
    const sCat = (movie.sourceCategory || movie.category || 'unknown').toLowerCase();
    const sYear = movie.sourceYear || movie.year || 'unknown';
    const key = `${sCat}-${sYear}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(movie);
  });

  // Write JSON and SQL files for each group
  Object.keys(groups).forEach(key => {
    const movieGroup = groups[key];
    
    // Sort movies by ID to keep order
    movieGroup.sort((a, b) => a.id.localeCompare(b.id));

    // Strip sourceCategory and sourceYear fields before saving to output file
    const exportList = movieGroup.map(m => {
      const { sourceCategory, sourceYear, ...rest } = m;
      return rest;
    });

    // 1. Export JSON
    const jsonFilename = `${key}.json`;
    const jsonPath = path.join(CONFIG.paths.JSON_DIR, jsonFilename);
    fs.writeFileSync(jsonPath, JSON.stringify(exportList, null, 2), 'utf8');
    
    if (CONFIG.DEBUG) {
      console.log(`[EXPORT] Saved JSON: ${jsonPath} (${exportList.length} movies)`);
    }

    // 2. Export SQL for Cloudflare D1
    const tableName = `movies_${key.replace(/-/g, '_')}`;
    const sqlFilename = `${key}.sql`;
    const sqlPath = path.join(CONFIG.paths.JSON_DIR, sqlFilename);
    
    let sqlContent = `-- Cloudflare D1 Import Script for ${key}\n`;
    sqlContent += `-- Generated on ${new Date().toISOString()}\n\n`;
    
    sqlContent += `DROP TABLE IF EXISTS ${tableName};\n\n`;
    
    sqlContent += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    sqlContent += `  id TEXT PRIMARY KEY,\n`;
    sqlContent += `  title TEXT,\n`;
    sqlContent += `  image TEXT,\n`;
    sqlContent += `  release TEXT,\n`;
    sqlContent += `  language TEXT,\n`;
    sqlContent += `  year TEXT,\n`;
    sqlContent += `  category TEXT,\n`;
    sqlContent += `  duration TEXT,\n`;
    sqlContent += `  director TEXT,\n`;
    sqlContent += `  starring TEXT,\n`;
    sqlContent += `  story TEXT,\n`;
    sqlContent += `  p360 TEXT,\n`;
    sqlContent += `  p720 TEXT,\n`;
    sqlContent += `  p1080 TEXT,\n`;
    sqlContent += `  created_at TEXT\n`;
    sqlContent += `);\n\n`;

    if (exportList.length > 0) {
      sqlContent += `INSERT INTO ${tableName} (id, title, image, release, language, year, category, duration, director, starring, story, p360, p720, p1080, created_at) VALUES\n`;
      
      const insertRows = exportList.map(m => {
        return `  ('${escapeSql(m.id)}', '${escapeSql(m.title)}', '${escapeSql(m.image)}', '${escapeSql(m.release)}', '${escapeSql(m.language)}', '${escapeSql(m.year)}', '${escapeSql(m.category)}', '${escapeSql(m.duration)}', '${escapeSql(m.director)}', '${escapeSql(m.starring)}', '${escapeSql(m.story)}', '${escapeSql(m.p360)}', '${escapeSql(m.p720)}', '${escapeSql(m.p1080)}', '${escapeSql(m.created_at)}')`;
      });
      
      sqlContent += insertRows.join(',\n') + ';\n';
    }

    fs.writeFileSync(sqlPath, sqlContent, 'utf8');
    if (CONFIG.DEBUG) {
      console.log(`[EXPORT] Saved Cloudflare D1 SQL: ${sqlPath}`);
    }
  });
}

module.exports = {
  exportJsonAndSql
};
