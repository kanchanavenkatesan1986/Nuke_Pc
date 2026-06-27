/**
 * CodeMaster - Main Application Controller
 * Handles global UI (Mobile Menu, Dark Mode events, Back to Top, Cookie Consent),
 * dynamic article parsing, custom syntax highlighting, SEO Schema injection,
 * Table of Contents compilation, and interactive project widgets initialization.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Global UI Components
    initPageLoader();
    initMobileNav();
    initScrollInteractions();
    initCookieConsent();
    
    // Page-specific routing
    const path = window.location.pathname;
    if (path.includes('tutorial.html')) {
        initArticleRenderer();
    } else if (path.includes('projects.html')) {
        initProjectsPage();
    } else if (path.includes('interview-questions.html')) {
        initInterviewQAInterface();
    }
});

/* ==========================================================================
   GLOBAL UI CONTROLLERS
   ========================================================================== */

function initPageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        window.addEventListener('load', () => {
            loader.classList.add('hidden');
        });
        // Safety timeout in case load event takes too long
        setTimeout(() => {
            loader.classList.add('hidden');
        }, 1500);
    }
}

function initMobileNav() {
    const toggle = document.querySelector('.mobile-nav-toggle');
    const nav = document.querySelector('.main-nav');
    
    if (toggle && nav) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            nav.classList.toggle('open');
            toggle.innerHTML = nav.classList.contains('open') ? '&#x2715;' : '&#x2630;';
        });

        // Close drawer on clicking outside
        document.addEventListener('click', (e) => {
            if (!nav.contains(e.target) && !toggle.contains(e.target)) {
                nav.classList.remove('open');
                toggle.innerHTML = '&#x2630;';
            }
        });
    }
}

function initScrollInteractions() {
    const header = document.querySelector('.site-header');
    const backToTopBtn = document.getElementById('back-to-top');
    const progressBar = document.getElementById('reading-progress');

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        
        // Sticky Header scroll styling
        if (header) {
            if (scrollTop > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }

        // Back to top button visibility
        if (backToTopBtn) {
            if (scrollTop > 400) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        }

        // Reading Progress Bar calculation
        if (progressBar && docHeight > 0) {
            const pct = (scrollTop / docHeight) * 100;
            progressBar.style.width = `${pct}%`;
        }
    });

    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function initCookieConsent() {
    const banner = document.getElementById('cookie-consent');
    const acceptBtn = document.getElementById('accept-cookies');
    const declineBtn = document.getElementById('decline-cookies');

    if (banner && acceptBtn) {
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) {
            setTimeout(() => {
                banner.classList.add('show');
            }, 2000);
        }

        acceptBtn.addEventListener('click', () => {
            localStorage.setItem('cookieConsent', 'accepted');
            banner.classList.remove('show');
        });

        if (declineBtn) {
            declineBtn.addEventListener('click', () => {
                localStorage.setItem('cookieConsent', 'declined');
                banner.classList.remove('show');
            });
        }
    }
}

/* ==========================================================================
   DYNAMIC ARTICLE RENDERER (tutorial.html)
   ========================================================================== */

function initArticleRenderer() {
    if (typeof articles === 'undefined') {
        showArticleError('Database connection error. Articles not loaded.');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');

    if (!articleId) {
        window.location.href = 'categories.html';
        return;
    }

    const article = articles.find(a => a.id === articleId);

    if (!article) {
        // Redirect to 404 page if topic is not registered
        window.location.href = '404.html';
        return;
    }

    // Populate SEO tags
    document.title = article.metaTitle || `${article.title} - CodeMaster`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', article.metaDescription);

    // Inject Schema.org data
    injectArticleSchema(article);

    // Render Breadcrumbs
    renderBreadcrumbs(article);

    // Render Sidebars
    renderSidebarLeft(article);

    // Render Main Article Body
    renderArticleContent(article);

    // Build Table of Contents
    buildTableOfContents();

    // Hook copy button clicks
    initCopyButtons();

    // Hook accordion triggers
    initAccordionEvents();

    // Render Related Articles
    renderRelatedArticles(article);
}

function showArticleError(msg) {
    const container = document.getElementById('article-content-panel');
    if (container) {
        container.innerHTML = `<div class="card" style="border-color:#ef4444;"><h3 style="color:#ef4444;">Error</h3><p>${msg}</p></div>`;
    }
}

function renderBreadcrumbs(article) {
    const container = document.getElementById('breadcrumbs-list');
    if (!container) return;

    let catName = article.category.toUpperCase();
    let catUrl = 'categories.html';

    if (article.category === 'html') { catName = 'HTML Tutorials'; catUrl = 'categories.html#html'; }
    else if (article.category === 'css') { catName = 'CSS Tutorials'; catUrl = 'categories.html#css'; }
    else if (article.category === 'javascript') { catName = 'JavaScript Tutorials'; catUrl = 'categories.html#javascript'; }
    else if (article.category === 'projects') { catName = 'Projects'; catUrl = 'projects.html'; }
    else if (article.category === 'blog') { catName = 'Blog'; catUrl = 'blog.html'; }
    else if (article.category === 'interview') { catName = 'Interview Questions'; catUrl = 'interview-questions.html'; }

    container.innerHTML = `
        <li class="breadcrumb-item"><a href="index.html">Home</a></li>
        <li class="breadcrumb-separator"><svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></li>
        <li class="breadcrumb-item"><a href="${catUrl}">${catName}</a></li>
        <li class="breadcrumb-separator"><svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></li>
        <li class="breadcrumb-item active" aria-current="page">${article.title}</li>
    `;
}

function renderSidebarLeft(article) {
    const list = document.getElementById('sidebar-menu-list');
    if (!list) return;

    // Filter articles in same category
    const catArticles = articles.filter(a => a.category === article.category);
    list.innerHTML = '';

    catArticles.forEach(a => {
        const item = document.createElement('li');
        const activeClass = a.id === article.id ? 'active' : '';
        const href = a.category === 'interview' ? `interview-questions.html?id=${a.id}` : `tutorial.html?id=${a.id}`;
        
        item.innerHTML = `<a href="${href}" class="sidebar-link ${activeClass}" title="${a.title}">${a.title}</a>`;
        list.appendChild(item);
    });
}

function renderArticleContent(article) {
    const titleEl = document.getElementById('article-title');
    const readTimeEl = document.getElementById('article-read-time');
    const bodyEl = document.getElementById('article-body-content');
    const navEl = document.getElementById('article-navigation');

    if (titleEl) titleEl.textContent = article.title;
    if (readTimeEl) readTimeEl.textContent = article.readTime;
    
    if (bodyEl) {
        let contentHtml = '';

        // 1. Introduction section
        contentHtml += `<section id="sec-intro"><h2>Introduction</h2><p>${article.introduction}</p></section>`;

        // 2. Definition section
        contentHtml += `<section id="sec-definition"><h2>What is ${article.title}?</h2><p>${article.definition}</p></section>`;

        // 3. Syntax block
        if (article.syntax) {
            contentHtml += `
                <section id="sec-syntax">
                    <h2>Syntax</h2>
                    <div class="code-block-wrapper">
                        <div class="code-block-header">
                            <span class="code-language">${article.category}</span>
                            <button class="copy-code-btn" data-clipboard-target="#syntax-code">
                                <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                                Copy
                            </button>
                        </div>
                        <pre><code id="syntax-code">${highlightCode(article.syntax, article.category)}</code></pre>
                    </div>
                </section>
            `;
        }

        // 4. Code Example and Output preview
        if (article.codeExample) {
            contentHtml += `
                <section id="sec-examples">
                    <h2>Code Examples</h2>
                    <div class="code-block-wrapper">
                        <div class="code-block-header">
                            <span class="code-language">${article.category}</span>
                            <button class="copy-code-btn" data-clipboard-target="#example-code">
                                <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                                Copy
                            </button>
                        </div>
                        <pre><code id="example-code">${highlightCode(article.codeExample, article.category)}</code></pre>
                    </div>
            `;

            if (article.outputExample) {
                contentHtml += `
                    <div class="output-preview">
                        <div class="output-title">Output Example</div>
                        <div class="output-content">${article.outputExample}</div>
                    </div>
                `;
            }

            contentHtml += `</section>`;
        }

        // 5. Explanation
        contentHtml += `<section id="sec-explanation"><h2>Code Explanation</h2><p>${article.explanation}</p></section>`;

        // 6. Google AdSense Inline Placeholder (Compliant spacing)
        contentHtml += `
            <div class="adsense-placeholder adsense-banner-horizontal">
                <span class="adsense-label">Advertisement</span>
                <span class="adsense-mock-content">Responsive Google AdSense Banner Slot</span>
            </div>
        `;

        // 7. Notes and Tips
        if (article.notes || article.tips) {
            contentHtml += `<section id="sec-notes"><h2>Key Notes & Tips</h2>`;
            if (article.notes) {
                contentHtml += `
                    <div class="content-box box-note">
                        <div class="box-note-title">
                            <svg style="width:20px; height:20px; fill:currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                            Important Note
                        </div>
                        <p>${article.notes}</p>
                    </div>
                `;
            }
            if (article.tips) {
                contentHtml += `
                    <div class="content-box box-tip">
                        <div class="box-tip-title">
                            <svg style="width:20px; height:20px; fill:currentColor" viewBox="0 0 24 24"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>
                            Developer Tip
                        </div>
                        <p>${article.tips}</p>
                    </div>
                `;
            }
            contentHtml += `</section>`;
        }

        // 8. Best Practices
        if (article.bestPractices && article.bestPractices.length > 0) {
            contentHtml += `<section id="sec-practices"><h2>Best Practices</h2><ul class="best-practices-list">`;
            article.bestPractices.forEach(bp => {
                contentHtml += `
                    <li class="best-practice-item">
                        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        <span>${bp}</span>
                    </li>
                `;
            });
            contentHtml += `</ul></section>`;
        }

        // 9. Interview Questions
        if (article.interviewQuestions && article.interviewQuestions.length > 0) {
            contentHtml += `<section id="sec-interview"><h2>Interview Questions</h2>`;
            article.interviewQuestions.forEach((iq, idx) => {
                contentHtml += `
                    <div class="accordion-item">
                        <div class="accordion-header">
                            <span>Q: ${iq.question}</span>
                            <svg class="accordion-icon" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                        </div>
                        <div class="accordion-content">
                            <p>${iq.answer}</p>
                        </div>
                    </div>
                `;
            });
            contentHtml += `</section>`;
        }

        // 10. Summary
        contentHtml += `<section id="sec-summary"><h2>Summary</h2><p>${article.summary}</p></section>`;

        // 11. FAQ section
        if (article.faqs && article.faqs.length > 0) {
            contentHtml += `<section id="sec-faq"><h2>Frequently Asked Questions</h2>`;
            article.faqs.forEach((faq, idx) => {
                contentHtml += `
                    <div class="accordion-item">
                        <div class="accordion-header">
                            <span>${faq.question}</span>
                            <svg class="accordion-icon" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                        </div>
                        <div class="accordion-content">
                            <p>${faq.answer}</p>
                        </div>
                    </div>
                `;
            });
            contentHtml += `</section>`;
        }

        // 12. If Category is projects, inject the live widget simulator
        if (article.category === 'projects' && article.widgetType) {
            contentHtml += `
                <section id="sec-project-widget">
                    <h2>Live Interactive Simulator</h2>
                    <div class="project-demo-box">
                        <div id="project-live-widget"></div>
                    </div>
                </section>
            `;
            setTimeout(() => {
                launchProjectWidget(article.widgetType);
            }, 100);
        }

        bodyEl.innerHTML = contentHtml;
    }

    // Render Next / Prev Nav buttons
    if (navEl) {
        const catArticles = articles.filter(a => a.category === article.category);
        const currentIndex = catArticles.findIndex(a => a.id === article.id);
        
        const prev = catArticles[currentIndex - 1];
        const next = catArticles[currentIndex + 1];
        
        let navHtml = '';
        
        if (prev) {
            const href = prev.category === 'interview' ? `interview-questions.html?id=${prev.id}` : `tutorial.html?id=${prev.id}`;
            navHtml += `
                <a href="${href}" class="article-nav-btn prev">
                    <span class="article-nav-label">Previous Topic</span>
                    <span class="article-nav-title">&larr; ${prev.title}</span>
                </a>
            `;
        } else {
            navHtml += `<div></div>`; // grid filler
        }

        if (next) {
            const href = next.category === 'interview' ? `interview-questions.html?id=${next.id}` : `tutorial.html?id=${next.id}`;
            navHtml += `
                <a href="${href}" class="article-nav-btn next">
                    <span class="article-nav-label">Next Topic</span>
                    <span class="article-nav-title">${next.title} &rarr;</span>
                </a>
            `;
        } else {
            navHtml += `<div></div>`;
        }

        navEl.innerHTML = navHtml;
    }
}

function buildTableOfContents() {
    const list = document.getElementById('toc-list-items');
    const sections = document.querySelectorAll('.article-body section');
    
    if (!list || sections.length === 0) return;
    
    list.innerHTML = '';
    
    sections.forEach(sec => {
        const id = sec.id;
        const title = sec.querySelector('h2').textContent;
        
        const item = document.createElement('li');
        item.innerHTML = `<a href="#${id}" class="toc-link">${title}</a>`;
        list.appendChild(item);
    });

    // Add IntersectionObserver to highlight active item in TOC
    const tocLinks = document.querySelectorAll('.toc-link');
    const observerOptions = {
        root: null,
        rootMargin: '-100px 0px -60%',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                tocLinks.forEach(link => {
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(sec => observer.observe(sec));
}

function initCopyButtons() {
    const copyBtns = document.querySelectorAll('.copy-code-btn');
    copyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSelector = btn.getAttribute('data-clipboard-target');
            const codeEl = document.querySelector(targetSelector);
            
            if (codeEl) {
                navigator.clipboard.writeText(codeEl.textContent).then(() => {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = `
                        <svg viewBox="0 0 24 24" style="fill:#10b981;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        Copied!
                    `;
                    btn.style.borderColor = '#10b981';
                    btn.style.color = '#10b981';
                    
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.borderColor = '';
                        btn.style.color = '';
                    }, 2000);
                });
            }
        });
    });
}

function initAccordionEvents() {
    const headers = document.querySelectorAll('.accordion-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const content = header.nextElementSibling;
            
            const isOpen = item.classList.contains('active');
            
            // Close all other accordion panels
            const categoryItems = item.parentElement.querySelectorAll('.accordion-item');
            categoryItems.forEach(i => {
                i.classList.remove('active');
                i.querySelector('.accordion-content').style.height = '0';
                i.querySelector('.accordion-content').style.padding = '0';
            });
            
            if (!isOpen) {
                item.classList.add('active');
                content.style.padding = '1.5rem';
                content.style.height = `${content.scrollHeight + 48}px`; // padding height offset
            }
        });
    });
}

function renderRelatedArticles(article) {
    const container = document.getElementById('related-posts-grid');
    if (!container) return;

    // Filter 3 related articles in same category (excluding current)
    const related = articles
        .filter(a => a.category === article.category && a.id !== article.id)
        .slice(0, 3);

    container.innerHTML = '';
    
    if (related.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; color: var(--text-muted);">No related articles available.</p>`;
        return;
    }

    related.forEach(a => {
        const card = document.createElement('div');
        card.className = 'card';
        
        let badgeClass = 'category-badge';
        if (a.category === 'html') badgeClass += ' badge-html';
        else if (a.category === 'css') badgeClass += ' badge-css';
        else if (a.category === 'javascript') badgeClass += ' badge-javascript';

        const href = a.category === 'interview' ? `interview-questions.html?id=${a.id}` : `tutorial.html?id=${a.id}`;

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; align-items: center;">
                <span class="${badgeClass}">${a.category}</span>
                <span style="font-size:0.8rem; color: var(--text-muted);">${a.readTime}</span>
            </div>
            <h4 class="card-title">${a.title}</h4>
            <p class="card-desc">${a.metaDescription.substring(0, 100)}...</p>
            <a href="${href}" class="card-link">
                Read Tutorial 
                <svg viewBox="0 0 24 24"><path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-8.29-1.42 1.42 5.43 5.43H5v2z"/></svg>
            </a>
        `;
        container.appendChild(card);
    });
}

/* ==========================================================================
   CUSTOM SYNTAX HIGHLIGHTER (Vanilla JS Tokenizer)
   ========================================================================== */

function highlightCode(code, language) {
    // Escape HTML boundaries
    let escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    if (language === 'html') {
        // Tag comments: &lt;!-- comment --&gt;
        escaped = escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="code-comment">$1</span>');
        
        // Tags: &lt;/?([a-zA-Z0-9]+)...&gt;
        escaped = escaped.replace(/(&lt;\/?[a-zA-Z0-9]+)(\s|&gt;)/g, '<span class="code-tag">$1</span>$2');
        escaped = escaped.replace(/([a-zA-Z0-9-]+)="([^"]*)"/g, '<span class="code-attr">$1</span>="<span class="code-string">$2</span>"');
    } 
    else if (language === 'css') {
        // Comments: /* comment */
        escaped = escaped.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="code-comment">$1</span>');
        
        // Selectors: .class, #id
        escaped = escaped.replace(/([\.#][a-zA-Z0-9_-]+)(?=\s*\{)/g, '<span class="code-keyword">$1</span>');
        
        // Properties and strings
        escaped = escaped.replace(/([a-zA-Z0-9-]+)(?=\s*:)/g, '<span class="code-tag">$1</span>');
        escaped = escaped.replace(/(:\s*)([^;\}]+)/g, '$1<span class="code-string">$2</span>');
    } 
    else if (language === 'javascript' || language === 'js') {
        // Double slash comments
        escaped = escaped.replace(/(\/\/[^\n]*)/g, '<span class="code-comment">$1</span>');
        
        // Keywords
        const keywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|super|import|export|from|new|async|await|try|catch|throw)\b/g;
        escaped = escaped.replace(keywords, '<span class="code-keyword">$1</span>');
        
        // Strings
        escaped = escaped.replace(/(['"`])(.*?)\1/g, '<span class="code-string">$1$2$1</span>');
        
        // Numbers
        escaped = escaped.replace(/\b(\d+)\b/g, '<span class="code-number">$1</span>');
        
        // Common objects/functions
        escaped = escaped.replace(/\b(console|document|window|localStorage|sessionStorage|JSON|Math|fetch|Promise)\b/g, '<span class="code-type">$1</span>');
    }

    return escaped;
}

/* ==========================================================================
   DYNAMIC SEO SCHEMA INJECTION
   ========================================================================== */

function injectArticleSchema(article) {
    // 1. Breadcrumb Schema
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": `${window.location.origin}/index.html`
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": article.category.toUpperCase(),
                "item": `${window.location.origin}/categories.html`
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": article.title,
                "item": window.location.href
            }
        ]
    };
    injectJsonLd(breadcrumbSchema, 'schema-breadcrumb');

    // 2. Article Schema
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": article.title,
        "description": article.metaDescription,
        "image": `${window.location.origin}/images/og-logo.png`,
        "author": {
            "@type": "Organization",
            "name": "CodeMaster"
        },
        "publisher": {
            "@type": "Organization",
            "name": "CodeMaster",
            "logo": {
                "@type": "ImageObject",
                "url": `${window.location.origin}/images/logo.png`
            }
        },
        "mainEntityOfPage": window.location.href,
        "datePublished": "2026-06-10T17:15:00+05:30"
    };
    injectJsonLd(articleSchema, 'schema-article');

    // 3. FAQ Schema
    if (article.faqs && article.faqs.length > 0) {
        const faqSchema = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": article.faqs.map(faq => ({
                "@type": "Question",
                "name": faq.question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.answer
                }
            }))
        };
        injectJsonLd(faqSchema, 'schema-faq');
    }
}

function injectJsonLd(obj, id) {
    let script = document.getElementById(id);
    if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = id;
        document.head.appendChild(script);
    }
    script.text = JSON.stringify(obj, null, 2);
}

/* ==========================================================================
   INTERACTIVE PROJECT WIDGETS ENGINE
   ========================================================================== */

function launchProjectWidget(type) {
    const parent = document.getElementById('project-live-widget');
    if (!parent) return;

    if (type === 'calculator') {
        parent.innerHTML = `
            <div class="calculator-widget">
                <div class="calc-display" id="calc-display">0</div>
                <div class="calc-buttons">
                    <button class="calc-btn op" onclick="clearCalc()">C</button>
                    <button class="calc-btn op" onclick="appendCalc('/')">/</button>
                    <button class="calc-btn op" onclick="appendCalc('*')">*</button>
                    <button class="calc-btn op" onclick="backspaceCalc()">&larr;</button>
                    <button class="calc-btn" onclick="appendCalc('7')">7</button>
                    <button class="calc-btn" onclick="appendCalc('8')">8</button>
                    <button class="calc-btn" onclick="appendCalc('9')">9</button>
                    <button class="calc-btn op" onclick="appendCalc('-')">-</button>
                    <button class="calc-btn" onclick="appendCalc('4')">4</button>
                    <button class="calc-btn" onclick="appendCalc('5')">5</button>
                    <button class="calc-btn" onclick="appendCalc('6')">6</button>
                    <button class="calc-btn op" onclick="appendCalc('+')">+</button>
                    <button class="calc-btn" onclick="appendCalc('1')">1</button>
                    <button class="calc-btn" onclick="appendCalc('2')">2</button>
                    <button class="calc-btn" onclick="appendCalc('3')">3</button>
                    <button class="calc-btn eq" onclick="evaluateCalc()">=</button>
                    <button class="calc-btn" onclick="appendCalc('0')" style="grid-column: span 2;">0</button>
                    <button class="calc-btn" onclick="appendCalc('.')">.</button>
                </div>
            </div>
        `;
        window.calcString = '';
        window.clearCalc = () => {
            window.calcString = '';
            document.getElementById('calc-display').textContent = '0';
        };
        window.appendCalc = (val) => {
            window.calcString += val;
            document.getElementById('calc-display').textContent = window.calcString;
        };
        window.backspaceCalc = () => {
            window.calcString = window.calcString.slice(0, -1);
            document.getElementById('calc-display').textContent = window.calcString || '0';
        };
        window.evaluateCalc = () => {
            try {
                // Using a safe computation approach instead of raw eval
                const result = Function('"use strict";return (' + window.calcString + ')')();
                document.getElementById('calc-display').textContent = result;
                window.calcString = result.toString();
            } catch (err) {
                document.getElementById('calc-display').textContent = 'Error';
                window.calcString = '';
            }
        };
    } 
    else if (type === 'todo') {
        parent.innerHTML = `
            <div class="todo-widget">
                <div class="todo-input-group">
                    <input type="text" id="todo-input" placeholder="Add a new task..." onkeydown="if(event.key==='Enter') addTodoItem()">
                    <button class="btn btn-primary" onclick="addTodoItem()" style="padding: 0.5rem 1rem;">Add</button>
                </div>
                <div class="todo-list" id="todo-list-items"></div>
            </div>
        `;
        window.todoTasks = JSON.parse(localStorage.getItem('widget-todos')) || [
            { text: "Learn Flexbox alignment", completed: false },
            { text: "Create sitemap structure", completed: true }
        ];
        
        window.addTodoItem = () => {
            const input = document.getElementById('todo-input');
            const text = input.value.trim();
            if (text) {
                window.todoTasks.push({ text, completed: false });
                localStorage.setItem('widget-todos', JSON.stringify(window.todoTasks));
                input.value = '';
                renderTodoWidget();
            }
        };

        window.toggleTodo = (index) => {
            window.todoTasks[index].completed = !window.todoTasks[index].completed;
            localStorage.setItem('widget-todos', JSON.stringify(window.todoTasks));
            renderTodoWidget();
        };

        window.deleteTodo = (index) => {
            window.todoTasks.splice(index, 1);
            localStorage.setItem('widget-todos', JSON.stringify(window.todoTasks));
            renderTodoWidget();
        };

        window.renderTodoWidget = () => {
            const list = document.getElementById('todo-list-items');
            list.innerHTML = '';
            window.todoTasks.forEach((task, idx) => {
                const item = document.createElement('div');
                item.className = `todo-item ${task.completed ? 'completed' : ''}`;
                item.innerHTML = `
                    <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                        <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTodo(${idx})">
                        <span>${task.text}</span>
                    </label>
                    <button class="todo-item-btn" onclick="deleteTodo(${idx})">&times;</button>
                `;
                list.appendChild(item);
            });
        };
        renderTodoWidget();
    }
    else if (type === 'weather') {
        parent.innerHTML = `
            <div class="todo-widget" style="text-align: center;">
                <div class="todo-input-group">
                    <input type="text" id="weather-city" placeholder="Enter city name..." value="New York">
                    <button class="btn btn-primary" onclick="fetchMockWeather()" style="padding: 0.5rem 1rem;">Get</button>
                </div>
                <div id="weather-result" style="margin-top: 1.5rem;"></div>
            </div>
        `;
        window.fetchMockWeather = () => {
            const city = document.getElementById('weather-city').value.trim();
            const result = document.getElementById('weather-result');
            if (!city) return;
            
            result.innerHTML = `<div class="spinner" style="width:30px; height:30px; margin:0 auto;"></div>`;
            
            setTimeout(() => {
                const conditions = ["Sunny ☀️", "Rainy 🌧️", "Cloudy ☁️", "Stormy ⛈️", "Snowy ❄️"];
                const temp = Math.floor(Math.random() * 35) + (conditions.includes("Snowy ❄️") ? -5 : 10);
                const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
                
                result.innerHTML = `
                    <h4 style="margin-bottom:0.25rem;">${city}</h4>
                    <p style="font-size:2rem; font-weight:700; margin:0.5rem 0; color:var(--primary);">${temp}°C</p>
                    <p style="font-weight:600; color:var(--text-secondary);">${randomCondition}</p>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.5rem;">[Simulated API response]</p>
                `;
            }, 800);
        };
        fetchMockWeather();
    }
    else if (type === 'stopwatch') {
        parent.innerHTML = `
            <div class="stopwatch-widget">
                <div class="stopwatch-display" id="stopwatch-display">00:00:00.00</div>
                <div class="stopwatch-controls">
                    <button class="btn btn-secondary" id="stopwatch-start" onclick="toggleStopwatch()" style="padding:0.5rem 1rem;">Start</button>
                    <button class="btn btn-secondary" onclick="resetStopwatch()" style="padding:0.5rem 1rem;">Reset</button>
                </div>
            </div>
        `;
        window.stopwatchInterval = null;
        window.stopwatchTime = 0;
        window.stopwatchRunning = false;
        
        window.toggleStopwatch = () => {
            const btn = document.getElementById('stopwatch-start');
            if (window.stopwatchRunning) {
                clearInterval(window.stopwatchInterval);
                window.stopwatchRunning = false;
                btn.textContent = 'Start';
                btn.style.color = '';
            } else {
                window.stopwatchRunning = true;
                btn.textContent = 'Pause';
                btn.style.color = '#ef4444';
                const startTime = Date.now() - window.stopwatchTime;
                window.stopwatchInterval = setInterval(() => {
                    window.stopwatchTime = Date.now() - startTime;
                    formatStopwatch(window.stopwatchTime);
                }, 10);
            }
        };

        window.resetStopwatch = () => {
            clearInterval(window.stopwatchInterval);
            window.stopwatchRunning = false;
            window.stopwatchTime = 0;
            document.getElementById('stopwatch-display').textContent = '00:00:00.00';
            const btn = document.getElementById('stopwatch-start');
            btn.textContent = 'Start';
            btn.style.color = '';
        };

        window.formatStopwatch = (time) => {
            const ms = Math.floor((time % 1000) / 10).toString().padStart(2, '0');
            const sec = Math.floor((time / 1000) % 60).toString().padStart(2, '0');
            const min = Math.floor((time / 60000) % 60).toString().padStart(2, '0');
            const hr = Math.floor(time / 3600000).toString().padStart(2, '0');
            document.getElementById('stopwatch-display').textContent = `${hr}:${min}:${sec}.${ms}`;
        };
    }
    else if (type === 'clock') {
        parent.innerHTML = `
            <div class="clock-widget" id="live-digital-clock">00:00:00 PM</div>
        `;
        window.updateDigitalClock = () => {
            const el = document.getElementById('live-digital-clock');
            if (el) {
                el.textContent = new Date().toLocaleTimeString();
            }
        };
        window.updateDigitalClock();
        window.clockIntervalId = setInterval(window.updateDigitalClock, 1000);
        // Clear interval on page changes
        window.addEventListener('beforeunload', () => {
            clearInterval(window.clockIntervalId);
        });
    }
    else if (type === 'quiz') {
        parent.innerHTML = `
            <div class="quiz-widget">
                <div id="quiz-question-container">
                    <p class="quiz-question" id="quiz-question-text"></p>
                    <div class="quiz-options" id="quiz-options-container"></div>
                </div>
                <div id="quiz-results" style="display:none; text-align:center;">
                    <h4>Quiz Completed!</h4>
                    <p style="font-size:2rem; font-weight:700; color:var(--primary); margin:1rem 0;" id="quiz-score"></p>
                    <button class="btn btn-primary" onclick="restartQuiz()">Restart Quiz</button>
                </div>
            </div>
        `;
        window.quizQuestions = [
            { q: "Which HTML5 tag defines self-contained article content?", options: ["<section>", "<article>", "<aside>", "<div>"], correct: 1 },
            { q: "What property is used in CSS to align grid items horizontally?", options: ["justify-items", "align-items", "flex-direction", "grid-gap"], correct: 0 },
            { q: "Which keyword declares block-level constant variables in JS?", options: ["var", "let", "const", "def"], correct: 2 }
        ];
        window.quizIndex = 0;
        window.quizScore = 0;
        
        window.renderQuizQuestion = () => {
            const qText = document.getElementById('quiz-question-text');
            const optionsBox = document.getElementById('quiz-options-container');
            const q = window.quizQuestions[window.quizIndex];
            
            qText.textContent = `Q${window.quizIndex + 1}: ${q.q}`;
            optionsBox.innerHTML = '';
            
            q.options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'quiz-option-btn';
                btn.textContent = opt;
                btn.onclick = () => submitQuizAnswer(idx, btn);
                optionsBox.appendChild(btn);
            });
        };

        window.submitQuizAnswer = (selected, btn) => {
            const q = window.quizQuestions[window.quizIndex];
            const btns = document.querySelectorAll('.quiz-option-btn');
            
            // Disable all options
            btns.forEach(b => b.removeAttribute('onclick'));
            
            if (selected === q.correct) {
                btn.classList.add('correct');
                window.quizScore++;
            } else {
                btn.classList.add('incorrect');
                btns[q.correct].classList.add('correct');
            }

            setTimeout(() => {
                window.quizIndex++;
                if (window.quizIndex < window.quizQuestions.length) {
                    renderQuizQuestion();
                } else {
                    document.getElementById('quiz-question-container').style.display = 'none';
                    const scoreBox = document.getElementById('quiz-results');
                    scoreBox.style.display = 'block';
                    document.getElementById('quiz-score').textContent = `${window.quizScore} / ${window.quizQuestions.length}`;
                }
            }, 1500);
        };

        window.restartQuiz = () => {
            window.quizIndex = 0;
            window.quizScore = 0;
            document.getElementById('quiz-question-container').style.display = 'block';
            document.getElementById('quiz-results').style.display = 'none';
            renderQuizQuestion();
        };
        renderQuizQuestion();
    }
    else if (type === 'notes') {
        parent.innerHTML = `
            <div class="todo-widget" style="max-width:400px;">
                <input type="text" id="note-title-input" placeholder="Note Title..." style="width:100%; border:1px solid var(--border-color); padding:0.5rem; margin-bottom:0.5rem; border-radius:4px; background:var(--bg-tertiary);">
                <textarea id="note-text-input" placeholder="Write something..." style="width:100%; height:80px; border:1px solid var(--border-color); padding:0.5rem; border-radius:4px; margin-bottom:0.5rem; background:var(--bg-tertiary); resize:none;"></textarea>
                <button class="btn btn-primary" onclick="addCustomNote()" style="width:100%; padding:0.5rem;">Save Note</button>
                <div id="notes-list-items" style="display:flex; flex-direction:column; gap:0.5rem; margin-top:1.5rem; max-height:150px; overflow-y:auto;"></div>
            </div>
        `;
        window.customNotes = JSON.parse(localStorage.getItem('widget-notes')) || [
            { title: "HTML Tip", text: "Always use double quotes for attributes." }
        ];

        window.addCustomNote = () => {
            const titleInput = document.getElementById('note-title-input');
            const textInput = document.getElementById('note-text-input');
            const title = titleInput.value.trim();
            const text = textInput.value.trim();
            if (title && text) {
                window.customNotes.push({ title, text });
                localStorage.setItem('widget-notes', JSON.stringify(window.customNotes));
                titleInput.value = '';
                textInput.value = '';
                renderNotesWidget();
            }
        };

        window.deleteNote = (index) => {
            window.customNotes.splice(index, 1);
            localStorage.setItem('widget-notes', JSON.stringify(window.customNotes));
            renderNotesWidget();
        };

        window.renderNotesWidget = () => {
            const container = document.getElementById('notes-list-items');
            container.innerHTML = '';
            window.customNotes.forEach((note, idx) => {
                const card = document.createElement('div');
                card.style.cssText = 'border:1px solid var(--border-color); padding:0.75rem; border-radius:4px; position:relative; background:var(--bg-tertiary);';
                card.innerHTML = `
                    <h5 style="margin-bottom:0.25rem;">${note.title}</h5>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">${note.text}</p>
                    <button onclick="deleteNote(${idx})" style="position:absolute; top:4px; right:4px; background:none; border:none; color:#ef4444; font-size:1.15rem; cursor:pointer;">&times;</button>
                `;
                container.appendChild(card);
            });
        };
        renderNotesWidget();
    }
    else if (type === 'password') {
        parent.innerHTML = `
            <div class="password-widget">
                <div class="password-display-box">
                    <span class="password-text" id="pwd-out">Click Generate</span>
                    <button class="btn-icon" onclick="copyPasswordToClipboard()" style="padding:4px;">
                        <svg style="width:14px; height:14px;" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    </button>
                </div>
                <div class="password-settings">
                    <div class="password-setting-row">
                        <label>Length: <span id="pwd-len-val">12</span></label>
                        <input type="range" id="pwd-len" min="6" max="24" value="12" oninput="document.getElementById('pwd-len-val').textContent=this.value">
                    </div>
                    <div class="password-setting-row">
                        <label><input type="checkbox" id="pwd-num" checked> Numbers (0-9)</label>
                    </div>
                    <div class="password-setting-row">
                        <label><input type="checkbox" id="pwd-sym" checked> Symbols (!@#$)</label>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="buildPasswordValue()" style="width:100%; padding:0.5rem;">Generate Password</button>
            </div>
        `;
        window.buildPasswordValue = () => {
            const len = parseInt(document.getElementById('pwd-len').value);
            const num = document.getElementById('pwd-num').checked;
            const sym = document.getElementById('pwd-sym').checked;
            
            let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            if (num) chars += '0123456789';
            if (sym) chars += '!@#$%^&*()_+~}{[]:;?><,./-=';
            
            let pwd = '';
            for (let i = 0; i < len; i++) {
                pwd += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            document.getElementById('pwd-out').textContent = pwd;
        };

        window.copyPasswordToClipboard = () => {
            const pwdText = document.getElementById('pwd-out').textContent;
            if (pwdText !== 'Click Generate') {
                navigator.clipboard.writeText(pwdText).then(() => {
                    alert('Password copied to clipboard!');
                });
            }
        };
    }
}

/* ==========================================================================
   PROJECTS HUB PAGE CONTROLLERS (projects.html)
   ========================================================================== */

function initProjectsPage() {
    const list = document.getElementById('projects-grid-items');
    if (!list) return;

    if (typeof articles === 'undefined') return;

    // Filter projects
    const projects = articles.filter(a => a.category === 'projects');
    list.innerHTML = '';

    projects.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card project-card';
        card.innerHTML = `
            <div class="project-card-header">
                <svg style="width:50px; height:50px; fill:currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/></svg>
            </div>
            <div style="padding: 1.5rem; flex-grow: 1; display:flex; flex-direction:column;">
                <span class="category-badge badge-projects" style="margin-bottom:0.5rem; align-self:flex-start;">PROJECT</span>
                <h3 class="card-title">${p.title}</h3>
                <p class="card-desc" style="flex-grow:1;">${p.metaDescription}</p>
                <a href="tutorial.html?id=${p.id}" class="btn btn-primary" style="margin-top:1rem; text-align:center;">Launch Project &rarr;</a>
            </div>
        `;
        list.appendChild(card);
    });
}

/* ==========================================================================
   INTERVIEW Q&A INTERFACE (interview-questions.html)
   ========================================================================== */

function initInterviewQAInterface() {
    const container = document.getElementById('interview-list-items');
    if (!container) return;

    if (typeof articles === 'undefined') return;

    const qaList = articles.filter(a => a.category === 'interview');
    renderInterviewQAList(qaList);

    // Bind category filters
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const category = btn.getAttribute('data-filter');
            if (category === 'all') {
                renderInterviewQAList(qaList);
            } else {
                const filtered = qaList.filter(q => q.id.includes(category));
                renderInterviewQAList(filtered);
            }
        });
    });
}

function renderInterviewQAList(list) {
    const container = document.getElementById('interview-list-items');
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">No questions available under this category.</p>`;
        return;
    }

    list.forEach(q => {
        const item = document.createElement('div');
        item.className = 'accordion-item';
        
        // Inside article, check questions
        const subQA = q.interviewQuestions[0] || { question: q.title, answer: q.metaDescription };
        
        item.innerHTML = `
            <div class="accordion-header">
                <span>${subQA.question}</span>
                <svg class="accordion-icon" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
            </div>
            <div class="accordion-content">
                <p>${subQA.answer}</p>
                <div style="margin-top:1.5rem; border-top:1px solid var(--border-color); padding-top:1rem; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.8rem; color:var(--text-muted);">Related topic: <a href="tutorial.html?id=${q.id}">${q.title}</a></span>
                    <a href="tutorial.html?id=${q.id}" class="card-link">Learn Core Concept &rarr;</a>
                </div>
            </div>
        `;
        container.appendChild(item);
    });

    initAccordionEvents();
}
