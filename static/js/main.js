// Server status check
let ollamaUrl = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';

// Add this after the variable declaration
if (window.location.hostname !== 'localhost') {
    // If we're not on localhost, try to get the URL from environment
    fetch('/api/server/url')
        .then(response => response.json())
        .then(data => {
            if (data.url) {
                ollamaUrl = data.url;
                localStorage.setItem('ollamaUrl', ollamaUrl);
            }
        })
        .catch(() => console.log('No server URL configured in environment'));
}

async function checkServerStatus() {
    try {
        const response = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) throw new Error('Server returned error status');
        
        const data = await response.json();
        
        const statusElement = document.getElementById('serverStatus');
        if (data.status === 'running') {
            statusElement.className = 'ui tiny positive message';
            statusElement.innerHTML = '<i class="check circle icon"></i>Le serveur Ollama est en cours d\'exécution';
        } else {
            statusElement.className = 'ui tiny negative message';
            statusElement.innerHTML = '<i class="times circle icon"></i>Le serveur Ollama est arrêté';
        }
    } catch (error) {
        console.error('Error checking server status:', error.message || 'Connection failed');
        const statusElement = document.getElementById('serverStatus');
        statusElement.className = 'ui tiny negative message';
        statusElement.innerHTML = '<i class="times circle icon"></i>Erreur de connexion au serveur';
    }
}

[Rest of the file content remains unchanged...]
