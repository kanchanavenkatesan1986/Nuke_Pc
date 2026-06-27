/**
 * CodeMaster - Search Engine Controller
 * Handles query parsing, keyword matching, result ranking, and search result rendering.
 */

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const resultsCountElement = document.getElementById('results-count');
    const queryTermElement = document.getElementById('query-term');

    // Make sure we have articles loaded
    if (typeof articles === 'undefined') {
        console.error('Articles database not loaded.');
        return;
    }

    // Parse URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q') || '';

    // Initialize search input
    if (searchInput) {
        searchInput.value = initialQuery;
        searchInput.addEventListener('input', debounce(() => {
            performSearch(searchInput.value);
        }, 300));
    }

    // Run initial search
    performSearch(initialQuery);

    function performSearch(query) {
        const trimmedQuery = query.trim().toLowerCase();
        
        // Update query text in UI
        if (queryTermElement) {
            queryTermElement.textContent = trimmedQuery ? `"${query}"` : 'all articles';
        }

        if (!trimmedQuery) {
            // Render all articles or a default state
            renderResults(articles);
            return;
        }

        // Search algorithm with scoring
        const results = articles.map(article => {
            let score = 0;
            const title = article.title.toLowerCase();
            const desc = article.metaDescription.toLowerCase();
            const intro = article.introduction.toLowerCase();
            const cat = article.category.toLowerCase();

            if (title.includes(trimmedQuery)) {
                score += 10; // High score for title match
                // Extra points for exact title matches
                if (title === trimmedQuery) score += 5;
            }
            if (desc.includes(trimmedQuery)) {
                score += 5; // Medium score for description match
            }
            if (intro.includes(trimmedQuery)) {
                score += 3;
            }
            if (cat.includes(trimmedQuery)) {
                score += 2;
            }

            return { article, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.article);

        renderResults(results, trimmedQuery);
    }

    function renderResults(results, query = '') {
        if (resultsCountElement) {
            resultsCountElement.textContent = results.length;
        }

        if (results.length === 0) {
            searchResultsContainer.innerHTML = `
                <div class="card" style="text-align: center; grid-column: 1 / -1; padding: 4rem 2rem;">
                    <div class="card-icon-wrapper" style="margin: 0 auto 1.5rem auto;">
                        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                    </div>
                    <h3>No results found</h3>
                    <p class="card-desc" style="max-width: 400px; margin: 0 auto;">We couldn't find any articles matching your search query. Try checking your spelling or searching for different topics like 'Flexbox', 'Loops' or 'Attributes'.</p>
                </div>
            `;
            return;
        }

        searchResultsContainer.innerHTML = '';
        
        results.forEach(article => {
            const card = document.createElement('article');
            card.className = 'card search-result-card';
            
            // Format category badge class
            let badgeClass = 'category-badge';
            if (article.category === 'html') badgeClass += ' badge-html';
            else if (article.category === 'css') badgeClass += ' badge-css';
            else if (article.category === 'javascript') badgeClass += ' badge-javascript';
            else if (article.category === 'projects') badgeClass += ' badge-projects';
            else if (article.category === 'interview') badgeClass += ' badge-interview';
            else if (article.category === 'blog') badgeClass += ' badge-blog';

            // Determine redirect URL
            let redirectUrl = `tutorial.html?id=${article.id}`;
            if (article.category === 'interview') {
                redirectUrl = `interview-questions.html?id=${article.id}`;
            }

            // Highlight query match in text
            const highlightedTitle = highlightKeyword(article.title, query);
            const highlightedDesc = highlightKeyword(article.metaDescription, query);

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <span class="${badgeClass}">${article.category}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${article.readTime}</span>
                </div>
                <h3 class="card-title"><a href="${redirectUrl}">${highlightedTitle}</a></h3>
                <p class="card-desc">${highlightedDesc}</p>
                <a href="${redirectUrl}" class="card-link">
                    Read Article 
                    <svg viewBox="0 0 24 24"><path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-8.29-1.42 1.42 5.43 5.43H5v2z"/></svg>
                </a>
            `;
            searchResultsContainer.appendChild(card);
        });
    }

    function highlightKeyword(text, keyword) {
        if (!keyword) return text;
        const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedKeyword})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    // Debounce helper to restrict execution rate
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});
