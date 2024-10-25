// Refresh intervals
const REFRESH_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;
let retryCount = 0;
let serverIsKnownOffline = false;
let lastKnownServerStatus = null;
let lastErrorTimestamp = 0;
const ERROR_DEBOUNCE_TIME = 5000; // 5 seconds

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    $('.ui.modal').modal();
    refreshAll();
    setInterval(checkServerStatus, REFRESH_INTERVAL);
});

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

    document.querySelectorAll('.ui.button:not(.modal .button)').forEach(btn => {
        if (isRunning) {
            btn.classList.remove('disabled');
            btn.disabled = false;
        } else {
            btn.classList.add('disabled');
            btn.disabled = true;
        }
    });

    document.querySelectorAll('input:not(.modal input)').forEach(input => {
        input.disabled = !isRunning;
    });

    document.querySelectorAll('.ui.checkbox input').forEach(checkbox => {
        checkbox.disabled = !isRunning;
    });
}

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

async function showModelConfig(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/config`);
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const config = await response.json();
        
        document.getElementById('selectedModels').innerHTML = `
            <div class="item">
                <i class="cube icon"></i>
                ${modelName}
            </div>
        `;
        document.getElementById('systemPrompt').value = config.system || '';
        document.getElementById('template').value = config.template || '';
        
        const parametersDiv = document.getElementById('parameters');
        parametersDiv.innerHTML = '';
        Object.entries(config.parameters || {}).forEach(([key, value]) => {
            parametersDiv.innerHTML += `
                <div class="ui segment">
                    <div class="two fields">
                        <div class="field">
                            <input type="text" value="${key}" readonly>
                        </div>
                        <div class="field">
                            <input type="text" value="${value}">
                        </div>
                    </div>
                </div>
            `;
        });
        
        $('#configModal').modal('show');
    } catch (error) {
        showMessage('Erreur', `Échec du chargement de la configuration du modèle : ${error.message}`);
    }
}

async function showModelStats(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/stats`);
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const stats = await response.json();
        
        document.getElementById('modelStats').innerHTML = `
            <h3>Statistiques de ${modelName}</h3>
            <div class="ui statistics">
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
            </div>
            
            <div class="ui segment">
                <h4>Opérations par Type</h4>
                <div class="ui list">
                    ${Object.entries(stats.operations_by_type || {})
                        .map(([type, count]) => `
                            <div class="item">
                                <i class="right triangle icon"></i>
                                <div class="content">
                                    <div class="header">${type}</div>
                                    <div class="description">${count} opérations</div>
                                </div>
                            </div>
                        `).join('')}
                </div>
            </div>
        `;
        
        $('#statsModal').modal('show');
    } catch (error) {
        showMessage('Erreur', `Échec du chargement des statistiques du modèle : ${error.message}`);
    }
}

async function deleteModel(modelName) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${modelName} ?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/models/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: modelName })
        });
        
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const result = await response.json();
        
        showMessage('Succès', result.message);
        refreshLocalModels();
    } catch (error) {
        showMessage('Erreur', `Échec de la suppression du modèle : ${error.message}`);
    }
}

function showMessage(title, message, isError = false) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('modalMessage').className = isError ? 'error-message' : 'success-message';
    $('#messageModal').modal('show');
}

function showSettings() {
    const ollamaUrl = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
    document.getElementById('ollamaUrl').value = ollamaUrl;
    $('#settingsModal').modal('show');
}

async function saveSettings() {
    const ollamaUrl = document.getElementById('ollamaUrl').value.trim();
    if (!ollamaUrl) {
        showMessage('Erreur', 'Veuillez saisir l\'URL du serveur Ollama', true);
        return;
    }
    
    try {
        localStorage.setItem('ollamaUrl', ollamaUrl);
        $('#settingsModal').modal('hide');
        showMessage('Succès', 'Paramètres enregistrés avec succès');
        window.location.reload();
    } catch (error) {
        showMessage('Erreur', error.message, true);
    }
}