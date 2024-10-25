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
function showSettings() {
    const url = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
    document.getElementById('ollamaUrl').value = url;
    $('#settingsModal').modal('show');
}

async function saveSettings() {
    const ollamaUrl = document.getElementById('ollamaUrl').value;
    if (ollamaUrl) {
        localStorage.setItem('ollamaUrl', ollamaUrl);
        headers = { 'X-Ollama-URL': ollamaUrl };
    }
    $('#settingsModal').modal('hide');
    refreshAll();
}

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
}

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

async function searchAndPullModel() {
    const modelName = document.getElementById('modelNameInput').value;
    if (!modelName) {
        return;
    }

    try {
        const searchResponse = await fetch('/api/models/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

async function pullModel(modelName) {
    if (!modelName) {
        modelName = document.getElementById('modelNameInput').value;
    }
    
    if (!modelName) {
        showMessage('Erreur', 'Veuillez entrer un nom de modèle', true);
        return;
    }

    try {
        const progressBar = document.getElementById('pullProgress');
        progressBar.style.display = 'block';
        progressBar.querySelector('.bar').style.width = '0%';
        progressBar.querySelector('.label').textContent = 'Démarrage du téléchargement...';

        const response = await fetch('/api/models/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Échec du téléchargement du modèle');
        }
        
        showMessage('Succès', `Modèle ${modelName} téléchargé avec succès`);
        refreshAll();
    } catch (error) {
        showMessage('Erreur', error.message, true);
    } finally {
        document.getElementById('pullProgress').style.display = 'none';
        document.querySelector('.search-results').style.display = 'none';
    }
}

async function stopModel(modelName) {
    try {
        const response = await fetch('/api/models/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: modelName })
        });
        
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const result = await response.json();
        
        showMessage('Succès', result.message);
        refreshRunningModels();
    } catch (error) {
        showMessage('Erreur', `Échec de l'arrêt du modèle : ${error.message}`);
    }
}

// Helper functions
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

function displayModels(models, containerId, errorMessage = null) {
    const container = document.getElementById(containerId);
    const tbody = container.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (errorMessage) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="ui warning message">
                        <div class="header">Erreur de Connexion au Serveur</div>
                        <p>Impossible de se connecter au serveur Ollama. Veuillez vérifier qu'il est en cours d'exécution et réessayer.</p>
                        <p>Assurez-vous qu'Ollama est installé et en cours d'exécution sur votre système.</p>
                    </div>
                </td>
            </tr>`;
        return;
    }
    
    if (!models || models.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="ui message">Aucun modèle trouvé</div></td></tr>';
        return;
    }
    
    for (const model of models) {
        const tr = document.createElement('tr');
        
        if (containerId === 'localModels') {
            tr.innerHTML = `
                <td class="collapsing">
                    <div class="ui fitted checkbox">
                        <input type="checkbox" data-model="${model.name}">
                        <label></label>
                    </div>
                </td>
            `;
        }
        
        tr.innerHTML += `
            <td>${model.name}</td>
            <td>${model.modified_at}</td>
            <td>${formatSize(model.size)}</td>
            <td>${model.details?.format || ''}</td>
            <td>${model.details?.family || ''}</td>
            <td>${model.details?.parameter_size || ''}</td>
            <td class="center aligned">
                <div class="ui tiny buttons">
                    <button class="ui primary button model-action-btn" onclick="showModelStats('${model.name}')">
                        <i class="chart bar icon"></i> Stats
                    </button>
                    <button class="ui teal button model-action-btn" onclick="showModelConfig('${model.name}')">
                        <i class="cog icon"></i> Config
                    </button>
                    ${containerId === 'localModels' ? `
                        <button class="ui negative button model-action-btn" onclick="deleteModel('${model.name}')">
                            <i class="trash icon"></i> Supprimer
                        </button>
                    ` : `
                        <button class="ui negative button model-action-btn" onclick="stopModel('${model.name}')">
                            <i class="stop icon"></i> Arrêter
                        </button>
                    `}
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    }

    $('.ui.checkbox').checkbox();
}

function formatSize(bytes) {
    const units = ['o', 'Ko', 'Mo', 'Go'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}
