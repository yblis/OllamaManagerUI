// Refresh intervals
const REFRESH_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;
let retryCount = 0;
let serverIsKnownOffline = false;
let lastKnownServerStatus = null;
let lastErrorTimestamp = 0;
const ERROR_DEBOUNCE_TIME = 5000; // 5 seconds

// Initialize UI elements
document.addEventListener('DOMContentLoaded', function() {
    refreshAll();
    $('.ui.checkbox').checkbox();
    $('.ui.dropdown').dropdown();
    $('.ui.modal').modal();
    
    // Add search listener
    document.getElementById('modelNameInput')?.addEventListener('input', debounce(searchAndPullModel, 500));
    
    // Set up periodic refresh for running models
    setInterval(refreshRunningModels, REFRESH_INTERVAL);
});

// Server status check and refresh functions
async function refreshAll() {
    if (!serverIsKnownOffline) {
        try {
            await Promise.all([
                refreshLocalModels(),
                refreshRunningModels(),
                refreshStats()
            ]);
        } catch (error) {
            handleServerError(error, 'Actualisation');
        }
    }
}

async function checkServerStatus() {
    try {
        const response = await fetch('/api/server/status');
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const data = await response.json();
        
        const currentStatus = data.status === 'running';
        if (lastKnownServerStatus !== currentStatus) {
            serverIsKnownOffline = !currentStatus;
            updateServerStatus(currentStatus);
            lastKnownServerStatus = currentStatus;
            
            if (currentStatus) {
                retryCount = 0;
                refreshAll();
            }
        }
    } catch (error) {
        handleServerError(error);
    }
}

function handleServerError(error, context = '') {
    const currentTime = Date.now();
    if (currentTime - lastErrorTimestamp > ERROR_DEBOUNCE_TIME) {
        console.error(`${context} Erreur :`, error.message);
        lastErrorTimestamp = currentTime;
        
        if (error.message.includes('503') || error.message.includes('Failed to fetch')) {
            if (!serverIsKnownOffline) {
                serverIsKnownOffline = true;
                updateServerStatus(false);
            }
        }
    }

    if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(checkServerStatus, 2000 * retryCount);
    }
}

function updateServerStatus(isRunning) {
    const statusDiv = document.getElementById('serverStatus');
    statusDiv.className = `ui tiny message ${isRunning ? 'positive' : 'negative'}`;
    statusDiv.innerHTML = `
        <i class="icon ${isRunning ? 'check circle' : 'times circle'}"></i>
        <span>Le serveur Ollama est ${isRunning ? 'en cours d\'exécution' : 'arrêté'}</span>
    `;

    // Update button states
    document.querySelectorAll('.ui.button:not(.modal .button)').forEach(btn => {
        if (isRunning) {
            btn.classList.remove('disabled');
            btn.disabled = false;
        } else {
            btn.classList.add('disabled');
            btn.disabled = true;
        }
    });
}

// Settings modal functions
window.showSettings = function() {
    const url = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
    document.getElementById('ollamaUrl').value = url;
    $('#settingsModal').modal('show');
};

window.saveSettings = async function() {
    const ollamaUrl = document.getElementById('ollamaUrl').value;
    if (ollamaUrl) {
        localStorage.setItem('ollamaUrl', ollamaUrl);
        headers = { 'X-Ollama-URL': ollamaUrl };
    }
    $('#settingsModal').modal('hide');
    await refreshAll();
};

// Model operations
async function refreshLocalModels() {
    if (serverIsKnownOffline) return;
    
    try {
        const response = await fetch('/api/models');
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const data = await response.json();
        displayModels(data.models || [], 'localModels');
    } catch (error) {
        handleServerError(error, 'Modèles Locaux');
        displayModels([], 'localModels', error.message);
    }
}

window.refreshRunningModels = async function() {
    if (serverIsKnownOffline) {
        displayModels([], 'runningModels', 'Le serveur est hors ligne');
        return;
    }
    
    try {
        const button = document.querySelector('button[onclick="refreshRunningModels()"]');
        if (button) {
            button.classList.add('loading');
        }
        
        const response = await fetch('/api/models/running');
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const data = await response.json();
        displayModels(data.models || [], 'runningModels');
    } catch (error) {
        handleServerError(error, 'Modèles en Cours d\'Exécution');
        displayModels([], 'runningModels', error.message);
    } finally {
        const button = document.querySelector('button[onclick="refreshRunningModels()"]');
        if (button) {
            button.classList.remove('loading');
        }
    }
};

async function refreshStats() {
    if (serverIsKnownOffline) return;
    
    try {
        const response = await fetch('/api/models/stats');
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const data = await response.json();
        
        const overallStats = document.getElementById('overallStats');
        overallStats.innerHTML = `
            <div class="ui statistic">
                <div class="value">${data.total_operations || 0}</div>
                <div class="label">Opérations Totales</div>
            </div>
            <div class="ui statistic">
                <div class="value">${data.total_prompt_tokens || 0}</div>
                <div class="label">Tokens de Prompt</div>
            </div>
            <div class="ui statistic">
                <div class="value">${data.total_completion_tokens || 0}</div>
                <div class="label">Tokens de Complétion</div>
            </div>
            <div class="ui statistic">
                <div class="value">${(data.total_duration || 0).toFixed(2)}s</div>
                <div class="label">Durée Totale</div>
            </div>
        `;
    } catch (error) {
        handleServerError(error, 'Statistiques');
    }
}

[...remaining JavaScript code remains unchanged...]
