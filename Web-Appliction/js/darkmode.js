/**
 * CodeMaster - Theme Management Controller
 * Handles light/dark theme toggle, localStorage persistence, and system setting fallback.
 */

(function () {
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Apply theme immediately to prevent flashing on load
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.documentElement.classList.add('dark-theme');
    } else {
        document.documentElement.classList.remove('dark-theme');
    }

    // Bind event listeners once the DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        const toggleButtons = document.querySelectorAll('.theme-toggle-btn');
        
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const isDark = document.documentElement.classList.contains('dark-theme');
                
                if (isDark) {
                    document.documentElement.classList.remove('dark-theme');
                    localStorage.setItem('theme', 'light');
                    triggerThemeChangeEvent('light');
                } else {
                    document.documentElement.classList.add('dark-theme');
                    localStorage.setItem('theme', 'dark');
                    triggerThemeChangeEvent('dark');
                }
            });
        });

        // Helper function to broadcast event to other components if needed
        function triggerThemeChangeEvent(theme) {
            const event = new CustomEvent('themeChanged', { detail: { theme } });
            window.dispatchEvent(event);
        }
    });
})();
