const cheerio = require('cheerio');
const { CONFIG } = require('./config');

/**
 * Extracts movie metadata from the detail page HTML
 * @param {string} html Raw HTML of the movie detail page
 * @param {string} pageUrl URL of the movie detail page
 * @param {string} defaultCategory Default category from source config
 * @param {string} defaultYear Default year from source config
 * @returns {object} Extracted movie details
 */
function extractDetails(html, pageUrl, defaultCategory, defaultYear) {
  const $ = cheerio.load(html);
  
  const movie = {
    title: '',
    poster: '',
    release: '',
    language: '',
    year: defaultYear,
    category: defaultCategory,
    duration: '',
    director: '',
    starring: '',
    story: ''
  };

  // 1. Title extraction
  // Try to find the h1 tag first
  movie.title = $('h1').text().trim();
  if (!movie.title) {
    // Try from title tag but strip site branding
    let titleTag = $('title').text().trim();
    if (titleTag) {
      titleTag = titleTag
        .replace(/Tamil Dubbed Movie Download isaiDub/gi, '')
        .replace(/Tamil Dubbed Movie Download/gi, '')
        .replace(/isaiDub/gi, '')
        .replace(/\|/g, '')
        .trim();
      movie.title = titleTag;
    }
  }

  // 2. Parse the info lists (e.g. ul.movie-info or similar tables/lists)
  $('ul.movie-info li, .movie-info-container li').each((_, elem) => {
    const strongText = $(elem).find('strong').text().trim().toLowerCase().replace(':', '');
    const spanText = $(elem).find('span').text().trim();
    
    if (strongText.includes('movie')) {
      if (!movie.title) movie.title = spanText;
    } else if (strongText.includes('director')) {
      movie.director = spanText;
    } else if (strongText.includes('starring') || strongText.includes('cast')) {
      movie.starring = spanText;
    } else if (strongText.includes('genres') || strongText.includes('category')) {
      movie.category = spanText;
    } else if (strongText.includes('language')) {
      movie.language = spanText;
    } else if (strongText.includes('last updated') || strongText.includes('added on') || strongText.includes('release')) {
      movie.release = spanText;
    } else if (strongText.includes('duration')) {
      movie.duration = spanText;
    }
  });

  // Fallback for Title
  if (!movie.title) {
    const listTitle = $('ul.movie-info li:first-child span').text().trim();
    if (listTitle) movie.title = listTitle;
  }

  // If title still has site branding, clean it up
  if (movie.title) {
    movie.title = movie.title
      .replace(/\s+Tamil Dubbed Movie Download isaiDub.*/gi, '')
      .replace(/\s+isaiDub.*/gi, '')
      .trim();
  }

  // 3. Fallbacks using standard selectors
  if (!movie.director) {
    movie.director = $('.director, .director-name, .movie-director').text().trim();
  }
  if (!movie.starring) {
    movie.starring = $('.starring, .cast, .actors, .movie-cast').text().trim();
  }
  if (!movie.category || movie.category === defaultCategory) {
    const categoryFallback = $('.category, .genre, .movie-genres').text().trim();
    if (categoryFallback) movie.category = categoryFallback;
  }
  if (!movie.duration) {
    movie.duration = $('.duration, .movie-duration').text().trim();
  }

  // 4. Synopsis/Story extraction
  const synopsisEl = $('.movie-synopsis, .synopsis, .story, .description');
  if (synopsisEl.length > 0) {
    let synopsisText = synopsisEl.text().trim();
    // Strip "Synopsis:" or "Story:" headers
    synopsisText = synopsisText
      .replace(/^Synopsis:\s*/i, '')
      .replace(/^Story:\s*/i, '')
      .trim();
    movie.story = synopsisText;
  }

  // 5. Poster Image Extraction
  let imageSrc = '';
  // Try picture source
  const pictureSource = $('.movie-info-container picture source, #movie-info picture source').first();
  if (pictureSource.length > 0) {
    imageSrc = pictureSource.attr('srcset') || pictureSource.attr('src');
  }
  // Try img inside container
  if (!imageSrc) {
    const containerImg = $('.movie-info-container img, #movie-info img, .albumcover img').first();
    imageSrc = containerImg.attr('src') || containerImg.attr('data-src');
  }
  // Try any image matching poster keywords
  if (!imageSrc) {
    $('img').each((_, img) => {
      const src = $(img).attr('src') || '';
      if (src.includes('poster') || src.includes('uploads/posters')) {
        imageSrc = src;
        return false; // break loop
      }
    });
  }

  if (imageSrc) {
    // Resolve absolute URL
    try {
      movie.poster = new URL(imageSrc, pageUrl).href;
    } catch (e) {
      movie.poster = imageSrc;
    }
  }

  // Parse Year from Title if not default or empty
  if (movie.title) {
    const yearMatch = movie.title.match(/\((\d{4})\)/);
    if (yearMatch) {
      movie.year = yearMatch[1];
    }
  }

  return movie;
}

module.exports = {
  extractDetails
};
