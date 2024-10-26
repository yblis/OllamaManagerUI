// Server status check
let ollamaUrl = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
let statusCheckTimeout = null;

// Add this after the variable declaration
if (window.location.hostname !== 'localhost') {
    // If we're not on localhost, try to get the URL from environment
    fetch('/api/server/url')
        .then(response => response.json())
        .then(data => {
            if (data.url) {
                ollamaUrl = data.url;
                localStorage.setItem('ollamaUrl', ollamaUrl);
                checkServerStatus(); // Check status immediately after getting URL
            }
        })
        .catch(error => {
            console.warn('Failed to fetch server URL from environment:', error);
        });
}

async function checkServerStatus() {
    if (statusCheckTimeout) {
        clearTimeout(statusCheckTimeout);
    }

    try {
        const response = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        const data = await response.json();
        
        const statusElement = document.getElementById('serverStatus');
        if (data.status === 'running') {
            statusElement.className = 'ui tiny positive message';
            statusElement.innerHTML = '<i class="check circle icon"></i>Le serveur Ollama est en cours d\'exécution';
            return true;
        } else {
            statusElement.className = 'ui tiny negative message';
            statusElement.innerHTML = '<i class="times circle icon"></i>Le serveur Ollama est arrêté';
            return false;
        }
    } catch (error) {
        console.warn('Error checking server status:', error);
        const statusElement = document.getElementById('serverStatus');
        statusElement.className = 'ui tiny negative message';
        statusElement.innerHTML = '<i class="times circle icon"></i>Erreur de connexion au serveur';
        return false;
    }
}

// Settings management
window.showSettings = function() {
    document.getElementById('ollamaUrl').value = ollamaUrl;
    $('#settingsModal').modal('show');
};

window.saveSettings = async function() {
    const newUrl = document.getElementById('ollamaUrl').value.trim();
    if (newUrl) {
        ollamaUrl = newUrl;
        localStorage.setItem('ollamaUrl', ollamaUrl);
        $('#settingsModal').modal('hide');
        
        // Check server status and refresh data
        const isConnected = await checkServerStatus();
        if (isConnected) {
            refreshAll();
        }
    }
};

// Message display
window.showMessage = function(title, message, isError = false) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('messageModal').className = `ui modal ${isError ? 'negative' : 'positive'}`;
    $('#messageModal').modal('show');
};

// Model management functions
window.stopModel = async function(modelName) {
    if (!await checkServerStatus()) {
        showMessage('Erreur', 'Le serveur Ollama n\'est pas disponible', true);
        return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir arrêter le modèle ${modelName} ?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/models/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Ollama-URL': ollamaUrl
            },
            body: JSON.stringify({ name: modelName })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Échec de l\'arrêt du modèle');
        }
        
        showMessage('Succès', `Modèle ${modelName} arrêté avec succès`);
        await refreshRunningModels();  // Refresh only running models table
    } catch (error) {
        showMessage('Erreur', error.message, true);
    }
};

// Model refresh functions
window.refreshLocalModels = async function() {
    try {
        const response = await fetch('/api/models', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) throw new Error('Failed to fetch local models');
        
        const data = await response.json();
        const tbody = document.querySelector('#localModels tbody');
        tbody.innerHTML = data.models.map(model => `
            <tr>
                <td class="collapsing">
                    <div class="ui fitted checkbox">
                        <input type="checkbox" data-model-name="${model.name}" onchange="toggleModelSelection(this, '${model.name}')">
                        <label></label>
                    </div>
                </td>
                <td>${model.name}</td>
                <td>${new Date(model.modified_at).toLocaleString()}</td>
                <td>${formatBytes(model.size)}</td>
                <td>${model.details?.format || 'N/A'}</td>
                <td>${model.details?.family || 'N/A'}</td>
                <td>${model.details?.parameter_size || 'N/A'}</td>
                <td class="center aligned">
                    <div class="ui tiny buttons">
                        <button class="ui button" onclick="showModelConfig('${model.name}')">
                            <i class="cog icon"></i> Config
                        </button>
                        <button class="ui teal button" onclick="showModelStats('${model.name}')">
                            <i class="chart bar icon"></i> Stats
                        </button>
                        <button class="ui negative button" onclick="deleteModel('${model.name}')">
                            <i class="trash icon"></i> Supprimer
                        </button>
                    </div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="8" class="center aligned">Aucun modèle installé</td></tr>';
    } catch (error) {
        console.error('Error refreshing local models:', error);
        showMessage('Erreur', error.message, true);
    }
};

window.refreshRunningModels = async function() {
    try {
        const response = await fetch('/api/models/running', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) throw new Error('Failed to fetch running models');
        
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
                    <button class="ui red tiny button" onclick="stopModel('${model.name}')">
                        <i class="stop icon"></i> Arrêter
                    </button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7" class="center aligned">Aucun modèle en cours d\'exécution</td></tr>';
    } catch (error) {
        console.error('Error refreshing running models:', error);
        showMessage('Erreur', error.message, true);
    }
};

async function refreshStats() {
    try {
        const response = await fetch('/api/models/stats', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) throw new Error('Failed to fetch stats');
        
        const stats = await response.json();
        document.getElementById('overallStats').innerHTML = `
            <div class="statistic">
                <div class="value">${stats.total_operations || 0}</div>
                <div class="label">Opérations Totales</div>
            </div>
            <div class="statistic">
                <div class="value">${stats.total_prompt_tokens || 0}</div>
                <div class="label">Tokens de Prompt</div>
            </div>
            <div class="statistic">
                <div class="value">${stats.total_completion_tokens || 0}</div>
                <div class="label">Tokens de Complétion</div>
            </div>
            <div class="statistic">
                <div class="value">${(stats.total_duration || 0).toFixed(2)}s</div>
                <div class="label">Durée Totale</div>
            </div>
        `;
    } catch (error) {
        console.error('Error refreshing stats:', error);
    }
}

async function refreshAll() {
    await Promise.all([
        refreshLocalModels(),
        refreshRunningModels(),
        refreshStats()
    ]);
}

// Utility functions
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkServerStatus();
    refreshAll();
    
    // Initialize all modals
    $('.ui.modal').modal({
        closable: false
    });
});

// Server status check interval
setInterval(checkServerStatus, 30000);
