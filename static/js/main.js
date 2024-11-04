// Server status check
let ollamaUrl = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
let checkServerInterval;

// Add this after the variable declaration
if (window.location.hostname !== 'localhost') {
    // If we're not on localhost, try to get the URL from environment
    fetch('/api/server/url')
        .then(response => response.json())
        .then(data => {
            if (data.url) {
                ollamaUrl = data.url;
                localStorage.setItem('ollamaUrl', ollamaUrl);
                checkServerStatus(); // Check server status immediately after getting URL
            }
        })
        .catch(error => {
            console.warn('Failed to get server URL:', error);
            showMessage('Erreur', 'Impossible de récupérer l\'URL du serveur', true);
        });
}

async function checkServerStatus() {
    try {
        const response = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        const data = await response.json();
        
        const statusElement = document.getElementById('serverStatus');
        if (statusElement) {
            if (data.status === 'running') {
                statusElement.className = 'ui tiny positive message';
                statusElement.innerHTML = '<i class="check circle icon"></i>Le serveur Ollama est en cours d\'exécution';
            } else {
                statusElement.className = 'ui tiny negative message';
                statusElement.innerHTML = '<i class="times circle icon"></i>Le serveur Ollama est arrêté';
            }
            window.animateElement(statusElement, 'fadeIn');
        }
    } catch (error) {
        console.warn('Error checking server status:', error);
        const statusElement = document.getElementById('serverStatus');
        if (statusElement) {
            statusElement.className = 'ui tiny negative message';
            statusElement.innerHTML = '<i class="times circle icon"></i>Erreur de connexion au serveur';
            window.animateElement(statusElement, 'fadeIn');
        }
    }
}

// Start periodic server status check
document.addEventListener('DOMContentLoaded', () => {
    checkServerStatus();
    // Check server status every 30 seconds
    checkServerInterval = setInterval(checkServerStatus, 30000);
});

// Clean up interval when page is unloaded
window.addEventListener('beforeunload', () => {
    if (checkServerInterval) {
        clearInterval(checkServerInterval);
    }
});

// The rest of main.js remains the same...
