// Animation configurations
const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.3 }
};

const slideUp = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { duration: 0.3 }
};

const scale = {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { duration: 0.2 }
};

// Initialize Framer Motion with CSS fallback
function initFramerMotion() {
    try {
        // Server status animation
        const serverStatus = document.getElementById('serverStatus');
        if (serverStatus) {
            serverStatus.style.animation = 'fadeIn 0.3s ease-out';
        }

        // Statistics animation
        const statistics = document.querySelectorAll('.statistic');
        statistics.forEach((stat, index) => {
            stat.style.animation = `scaleIn 0.3s ease-out ${index * 0.1}s`;
        });

        // Table rows animation
        const tableRows = document.querySelectorAll('tbody tr');
        tableRows.forEach((row, index) => {
            row.style.animation = `slideUp 0.3s ease-out ${index * 0.05}s`;
        });

        // Button hover animations
        const buttons = document.querySelectorAll('.ui.button');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'scale(1.05)';
                button.style.transition = 'transform 0.2s ease-out';
            });
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
                button.style.transition = 'transform 0.2s ease-out';
            });
        });

        // Modal animations
        const modals = document.querySelectorAll('.ui.modal');
        modals.forEach(modal => {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.target.classList.contains('visible')) {
                        modal.style.animation = 'scaleIn 0.2s ease-out';
                    }
                });
            });
            observer.observe(modal, { attributes: true });
        });

    } catch (error) {
        console.warn('Animation initialization failed, using CSS fallbacks:', error);
    }
}

// Initialize animations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initFramerMotion();
    setupErrorHandling();
});

// Setup error handling for network requests
function setupErrorHandling() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        try {
            const response = await originalFetch(...args);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Une erreur est survenue');
            }
            return response;
        } catch (error) {
            console.error('Network request failed:', error);
            // Show error in UI
            const errorMessage = error.message || 'Erreur de connexion au serveur';
            const serverStatus = document.getElementById('serverStatus');
            if (serverStatus) {
                serverStatus.className = 'ui tiny negative message';
                serverStatus.innerHTML = `<i class="times circle icon"></i>${errorMessage}`;
                serverStatus.style.animation = 'fadeIn 0.3s ease-out';
            }
            throw error;
        }
    };
}

// Re-run animations on dynamic content updates
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            // Only animate new content
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    if (node.classList.contains('statistic')) {
                        node.style.animation = 'scaleIn 0.3s ease-out';
                    } else if (node.tagName === 'TR') {
                        node.style.animation = 'slideUp 0.3s ease-out';
                    }
                }
            });
        }
    });
});

// Start observing the document with the configured parameters
observer.observe(document.body, { childList: true, subtree: true });

// Export animation functions for use in main.js
window.animateElement = function(element, animation) {
    if (!element) return;
    
    switch(animation) {
        case 'fadeIn':
            element.style.animation = 'fadeIn 0.3s ease-out';
            break;
        case 'slideUp':
            element.style.animation = 'slideUp 0.3s ease-out';
            break;
        case 'scaleIn':
            element.style.animation = 'scaleIn 0.3s ease-out';
            break;
    }
};
