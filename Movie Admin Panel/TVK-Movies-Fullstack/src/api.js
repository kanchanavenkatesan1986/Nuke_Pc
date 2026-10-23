/**
 * TVK-Movies-Fullstack API Layer
 * Fetches from Admin Panel per-table endpoints: /api/{type}_{year}
 * 
 * Base URL: https://api-database.akatsuki-pvt-ltd.workers.dev/api
 * Endpoint: /api/tamil_2026, /api/hollywood_2025, etc.
 */

const API_BASE = "https://api-database.akatsuki-pvt-ltd.workers.dev/api";

// All available types and years — keep in sync with Admin Panel TABLE_CONFIG
const TYPES = ["tamil", "hollywood"];
const YEARS = ["2026", "2025", "2024", "2023", "2022"];

const api = {

    /**
     * Fetch movies from a specific table: /api/{type}_{year}
     * @param {string} type - e.g. 'tamil', 'hollywood'
     * @param {string} year - e.g. '2026'
     * @returns {Promise<Array>}
     */
    getMoviesByTable: function(type, year) {
        const url = API_BASE + "/" + type.toLowerCase() + "_" + year;
        return fetch(url)
            .then(function(res) {
                if (!res.ok) throw new Error("Failed: " + res.status);
                return res.json();
            })
            .then(function(data) {
                // Handle both plain array and { success, data: [] } wrapper
                if (Array.isArray(data)) return data;
                if (data && Array.isArray(data.data)) return data.data;
                return [];
            });
    },

    /**
     * Fetch ALL movies from ALL tables (for search, trending, new-releases).
     * Merges results from every type+year combination.
     * @returns {Promise<Array>}
     */
    getAllMovies: function() {
        var promises = [];
        TYPES.forEach(function(type) {
            YEARS.forEach(function(year) {
                promises.push(
                    api.getMoviesByTable(type, year)
                        .then(function(movies) {
                            // Tag each movie with its type for identification
                            return movies.map(function(m) {
                                if (!m.type) m.type = type;
                                return m;
                            });
                        })
                        .catch(function() { return []; })
                );
            });
        });
        return Promise.all(promises).then(function(results) {
            var all = [];
            results.forEach(function(arr) {
                all = all.concat(arr);
            });
            return all;
        });
    },

    /**
     * Find a single movie by ID across ALL tables.
     * Returns { movie, type, year } or null.
     * @param {string|number} id
     * @returns {Promise<Object|null>}
     */
    findMovieById: function(id) {
        return api.getAllMovies().then(function(all) {
            var found = all.find(function(m) { return m.id == id; });
            return found || null;
        });
    },

    /**
     * Fetch slider data.
     * @returns {Promise<Array>}
     */
    getSlider: function() {
        return fetch(API_BASE + "/../slider")
            .then(function(res) {
                if (!res.ok) throw new Error("Failed to fetch slider: " + res.status);
                return res.json();
            })
            .then(function(data) {
                if (Array.isArray(data)) return data;
                if (data && Array.isArray(data.data)) return data.data;
                return [];
            });
    },

    /** Expose config for dynamic UI */
    TYPES: TYPES,
    YEARS: YEARS
};

window.api = api;
