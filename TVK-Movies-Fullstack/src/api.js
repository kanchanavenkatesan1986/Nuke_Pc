const API_BASE = "https://database.akatsuki-pvt-ltd.workers.dev";

const safeStorage = {
    getItem: function(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            return null;
        }
    },
    setItem: function(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            // Ignore error
        }
    }
};

const api = {
    getMovies: function() {
        const cached = safeStorage.getItem("movies_data");
        if (cached) {
            try {
                return Promise.resolve(JSON.parse(cached));
            } catch (e) {
                console.error("Error parsing cached movies:", e);
            }
        }
        return fetch(`${API_BASE}/movies`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch movies: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                safeStorage.setItem("movies_data", JSON.stringify(data));
                return data;
            });
    },
    getSlider: function() {
        const cached = safeStorage.getItem("slider_data");
        if (cached) {
            try {
                return Promise.resolve(JSON.parse(cached));
            } catch (e) {
                console.error("Error parsing cached slider:", e);
            }
        }
        return fetch(`${API_BASE}/slider`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch slider: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                safeStorage.setItem("slider_data", JSON.stringify(data));
                return data;
            });
    }
};

window.api = api;
console.log("api.js finished executing, window.api is", window.api);
