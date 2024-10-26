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

// Model management functions
async function stopModel(modelName) {
    try {
        const response = await fetch('/api/models/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Ollama-URL': ollamaUrl
            },
            body: JSON.stringify({ name: modelName })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Échec de l'arrêt du modèle');
        }
        
        const result = await response.json();
        showMessage('Succès', result.message || 'Modèle arrêté avec succès');
        refreshRunningModels();
    } catch (error) {
        showMessage('Erreur', error.message, true);
    }
}

// Running models refresh function
async function refreshRunningModels() {
    try {
        const response = await fetch('/api/models/running', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) throw new Error('Échec de la récupération des modèles en cours d'exécution');
        
        const data = await response.json();
        const tbody = document.querySelector('#runningModels tbody');
        tbody.innerHTML = data.models.map(model => `
            <tr>
                <td>${model.name}</td>
                <td>${new Date(model.modified_at).toLocaleString()}</td>
                <td>${formatBytes(model.size)}</td>
                <td>${model.details?.format || 'N/A'}</td>
                <td>${model.details?.family || 'N/A'}</td>
                <td>${model.details?.parameter_size || 'N/A'}</td>
                <td class="center aligned">
                    <button class="ui negative button" onclick="stopModel('${model.name}')">
                        <i class="stop icon"></i> Arrêter
                    </button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7" class="center aligned">Aucun modèle en cours d'exécution</td></tr>';
    } catch (error) {
        console.error('Error refreshing running models:', error);
        showMessage('Erreur', error.message, true);
    }
}

// Initialize refresh timer for running models
document.addEventListener('DOMContentLoaded', () => {
    // First check
    refreshRunningModels();
    // Then check every 30 seconds
    setInterval(refreshRunningModels, 30000);
});
