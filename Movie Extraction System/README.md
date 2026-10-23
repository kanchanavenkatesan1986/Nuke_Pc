# TVK Movies Data Extractor

A complete, production-ready Node.js-based web extraction system for movie metadata and download links. This scraper crawls paginated directories of `isaidub.ceo`, downloads poster images, cleans fields, structures JSON files, generates unique identifiers, and automates SQL generation for Cloudflare D1/R2 databases.

---

## Project Structure

```text
TVK-Movie-Extractor/
├── package.json
├── sources.json
├── README.md
├── .env
├── d1_importer.js
├── scraper/
│   ├── start.js
│   ├── config.js
│   ├── browser.js
│   ├── collect_urls.js
│   ├── extract_details.js
│   ├── extract_links.js
│   ├── download_images.js
│   ├── clean_data.js
│   ├── generate_id.js
│   └── export_json.js
├── data/
│   ├── temp/
│   │   └── movie_urls.json
│   └── json/
│       ├── tamil-2026.json
│       ├── tamil-2026.sql
│       ├── hollywood-2026.json
│       └── hollywood-2026.sql
├── images/
│   ├── tamil/
│   │   └── 2026/
│   └── hollywood/
│        └── 2026/
└── logs/
    ├── failed_movies.json
    ├── missing_fields.json
    └── duplicate_movies.json
```

---

## Installation

### 1. Install Node.js Dependencies
Clone this repository and run the following command to download all required packages:
```bash
npm install
```

### 2. Install Playwright Browsers
Download the Chromium browser executable used by Playwright for extracting pages:
```bash
npx playwright install chromium
```

---

## Configuration

### Sources Setup (`sources.json`)
Manage target crawls by adding objects to `sources.json` in the root directory. Do not add fields other than `category`, `year`, and `url`.

```json
[
  {
    "category": "tamil",
    "year": "2026",
    "url": "https://isaidub.ceo/tamil-2026-dubbed-movies/"
  },
  {
    "category": "hollywood",
    "year": "2026",
    "url": "https://isaidub.ceo/hollywood-2026-movies/"
  }
]
```

### Environment Variables (`.env`)
You can tweak performance, retry counts, and debug levels inside `.env`:

```env
# Verbose logs toggling
DEBUG=true

# Headless mode for Playwright browser
HEADLESS=true

# Timeout for individual pages (ms)
REQUEST_TIMEOUT=30000

# Retries on network errors
RETRY_LIMIT=3

# Throttling delays (randomized range in ms)
DELAY_MIN=1000
DELAY_MAX=3000

# Download image toggles
DOWNLOAD_IMAGES=true
```

---

## How to Run

To run the complete extraction pipeline, execute the main entrypoint:
```bash
node scraper/start.js
```

### Script Execution Lifecycle
1. **Initialize**: Creates missing folders (`data/temp`, `data/json`, `images`, `logs`).
2. **Collect**: Traverses category list pages and pagination links (`?get-page=X`), outputting lists to `data/temp/movie_urls.json`.
3. **Parse Details**: Visits each movie page, parsing titles, actors, languages, directors, ratings, and story metadata.
4. **Extract Links**: Navigates download portals, following the depth paths down to final file server links for `p360`, `p720`, and `p1080` versions, capturing video duration.
5. **Posters**: Downloads posters locally to `images/<category>/<year>/` naming them after the movie.
6. **Unique IDs**: Generates sequential IDs such as `tamil-2026-00001` resetting per category/year.
7. **Clean & Validate**: Formats text, logs missing metadata fields to `logs/missing_fields.json`, filters out duplicates to `logs/duplicate_movies.json`, and records page errors in `logs/failed_movies.json`.
8. **Export**: Generates structured `.json` datasets and Cloudflare D1-compatible `.sql` scripts.

---

## How to Test One Category

To isolate and test a single category/year run:
1. Open `sources.json`.
2. Delete all other source entries so only your target category remains in the array:
   ```json
   [
     {
       "category": "tamil",
       "year": "2026",
       "url": "https://isaidub.ceo/tamil-2026-dubbed-movies/"
     }
   ]
   ```
3. Run `node scraper/start.js`.

---

## Resume Support

If the scraper is stopped or crashed, you can restart it with:
```bash
node scraper/start.js
```
The scraper will read the final output JSON files in `data/json/` and automatically skip processing movie pages that have already been fully written. It will load past sequence counters to resume assigning IDs starting from the correct increment.

---

## Cloudflare D1/R2 Deployment

### 1. Hosting Images on Cloudflare R2
The scraper downloads images to `images/<category>/<year>/`. You can upload this entire folder structure to your Cloudflare R2 bucket:
* Using Cloudflare Dashboard, drag and drop the `images/` directory.
* Using Wrangler CLI:
  ```bash
  wrangler r2 object put my-bucket-name/images/ --file=./images
  ```

### 2. Importing SQL Data to Cloudflare D1
Use the built-in database import script to migrate data:

**Local D1 Database:**
```bash
node d1_importer.js --database <YOUR_DB_NAME>
```

**Remote D1 Database:**
```bash
node d1_importer.js --database <YOUR_DB_NAME> --remote
```

---

## Troubleshooting & Common Errors

* **Error: Timeout during page load**: Increase `REQUEST_TIMEOUT` in your `.env` file (e.g. to `60000`).
* **Cloudflare / Anti-Bot blocks**: Playwright includes human-like viewport dimensions and rotating standard HTTP headers. If blocking occurs, try changing `HEADLESS=false` in `.env` or adjusting `DELAY_MIN` and `DELAY_MAX` to slow down the scraping speed.
* **Missing IDs or Duplicates**: Check the `logs/duplicate_movies.json` and `logs/missing_fields.json` directories for details. The system keeps all records in the output JSON, even if fields like description or cast are empty.
