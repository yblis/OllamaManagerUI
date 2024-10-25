// Refresh intervals
const REFRESH_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;
let retryCount = 0;
let serverIsKnownOffline = false;
let lastKnownServerStatus = null;
let lastErrorTimestamp = 0;
const ERROR_DEBOUNCE_TIME = 5000; // 5 seconds
let headers = {}; // Global headers object

// Initialize UI elements
document.addEventListener('DOMContentLoaded', function() {
    // Initialize headers from localStorage if available
    const savedUrl = localStorage.getItem('ollamaUrl');
    if (savedUrl) {
        headers = { 'X-Ollama-URL': savedUrl };
    }
    
    refreshAll();
    $('.ui.checkbox').checkbox();
    $('.ui.dropdown').dropdown();
    $('.ui.modal').modal();
    
    // Fix the event listener syntax
    const modelInput = document.getElementById('modelNameInput');
    if (modelInput) {
        modelInput.addEventListener('input', debounce(searchAndPullModel, 500));
    }
    
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
        const response = await fetch('/api/server/status', { headers });
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

// Settings modal functions
function showSettings() {
    const url = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
    document.getElementById('ollamaUrl').value = url;
    $('#settingsModal').modal('show');
}

async function saveSettings() {
    const ollamaUrl = document.getElementById('ollamaUrl').value;
    if (ollamaUrl) {
        localStorage.setItem('ollamaUrl', ollamaUrl);
        // Use headers in the global scope to ensure it's properly set
        headers = { 'X-Ollama-URL': ollamaUrl };
        // Add headers to all future requests
        await refreshAll();
    }
    $('#settingsModal').modal('hide');
}

// Model operations
async function refreshLocalModels() {
    try {
        const response = await fetch('/api/models', { headers });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        displayModels(data.models || [], 'localModels');
    } catch (error) {
        console.error('Error:', error);
        displayModels([], 'localModels', error.message);
    }
}

async function refreshRunningModels() {
    if (serverIsKnownOffline) {
        displayModels([], 'runningModels', 'Le serveur est hors ligne');
        return;
    }
    
    try {
        const button = document.querySelector('button[onclick="refreshRunningModels()"]');
        if (button) {
            button.classList.add('loading');
        }
        
        const response = await fetch('/api/models/running', { headers });
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const data = await response.json();
        displayModels(data.models || [], 'runningModels');
    } catch (error) {
        console.error('Error:', error);
        displayModels([], 'runningModels', error.message);
    } finally {
        const button = document.querySelector('button[onclick="refreshRunningModels()"]');
        if (button) {
            button.classList.remove('loading');
        }
    }
}

async function refreshStats() {
    if (serverIsKnownOffline) {
        return;
    }
    
    try {
        const response = await fetch('/api/models/stats', { headers });
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

async function searchAndPullModel() {
    const modelName = document.getElementById('modelNameInput').value;
    if (!modelName) return;

    try {
        const searchResponse = await fetch('/api/models/search', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...headers 
            },
            body: JSON.stringify({ keyword: modelName })
        });
        
        if (!searchResponse.ok) throw new Error('Erreur lors de la recherche');
        const searchData = await searchResponse.json();
        
        const searchResults = document.getElementById('searchResults');
        const searchResultsContainer = document.querySelector('.search-results');
        
        if (searchData.models && searchData.models.length > 0) {
            searchResults.innerHTML = searchData.models.map(model => `
                <div class="item">
                    <div class="content">
                        <div class="header">${model.name}</div>
                        <div class="description">
                            <div class="ui labels">
                                ${model.tags.map(tag => `
                                    <div class="ui label">
                                        ${tag}
                                        <button class="ui mini primary button" onclick="pullModel('${model.name}:${tag}')">
                                            <i class="download icon"></i>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
            searchResultsContainer.style.display = 'block';
        } else {
            searchResults.innerHTML = '<div class="ui message">Aucun modèle trouvé</div>';
            searchResultsContainer.style.display = 'block';
        }
    } catch (error) {
        showMessage('Erreur', error.message, true);
        const searchResultsContainer = document.querySelector('.search-results');
        searchResultsContainer.style.display = 'none';
    }
}

function handleServerError(error, context = '') {
    const currentTime = Date.now();
    if (currentTime - lastErrorTimestamp > ERROR_DEBOUNCE_TIME) {
        console.error(error);
        showMessage('Erreur Serveur', 
            `${context ? context + ': ' : ''}${error.message}. Veuillez vérifier que le serveur Ollama est en cours d'exécution.`, 
            true
        );
        lastErrorTimestamp = currentTime;
    }
    serverIsKnownOffline = true;
    updateServerStatus(false);
}

function updateServerStatus(isOnline) {
    const statusDiv = document.getElementById('serverStatus');
    if (!statusDiv) return;

    statusDiv.className = `ui tiny message ${isOnline ? 'positive' : 'negative'}`;
    statusDiv.innerHTML = `
        <i class="icon ${isOnline ? 'check circle' : 'times circle'}"></i>
        <span>Le serveur Ollama est ${isOnline ? 'en cours d'exécution' : 'arrêté'}</span>
    `;
}

function showMessage(title, message, isError = false) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('modalMessage').className = isError ? 'error-message' : 'success-message';
    $('#messageModal').modal('show');
}

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

// Initialize periodic server status check
setInterval(checkServerStatus, REFRESH_INTERVAL);

// Make functions available globally
window.showSettings = showSettings;
window.saveSettings = saveSettings;
window.refreshRunningModels = refreshRunningModels;
window.pullModel = pullModel;
window.deleteModel = deleteModel;
window.showModelConfig = showModelConfig;
window.showModelStats = showModelStats;
window.stopModel = stopModel;
