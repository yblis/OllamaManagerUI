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
        .catch(console.error);
}

async function checkServerStatus() {
    try {
        const response = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
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
        console.error('Error checking server status:', error);
        const statusElement = document.getElementById('serverStatus');
        statusElement.className = 'ui tiny negative message';
        statusElement.innerHTML = '<i class="times circle icon"></i>Erreur de connexion au serveur';
    }
}

// Settings management
window.showSettings = function() {
    document.getElementById('ollamaUrl').value = ollamaUrl;
    $('#settingsModal').modal('show');
};

window.saveSettings = function() {
    const newUrl = document.getElementById('ollamaUrl').value.trim();
    if (newUrl) {
        ollamaUrl = newUrl;
        localStorage.setItem('ollamaUrl', ollamaUrl);
        $('#settingsModal').modal('hide');
        checkServerStatus();
        refreshAll();
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
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Échec de l\'arrêt du modèle');
        }
        
        showMessage('Succès', `Modèle ${modelName} arrêté avec succès`);
        await refreshRunningModels();  // Refresh only running models table
    } catch (error) {
        showMessage('Erreur', error.message, true);
    }
};

window.showModelConfig = async function(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/config`, {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
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
        
        const parametersContainer = document.getElementById('parameters');
        parametersContainer.innerHTML = '';
        
        Object.entries(config.parameters || {}).forEach(([key, value]) => {
            parametersContainer.innerHTML += `
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
        showMessage('Erreur', error.message, true);
    }
};

window.showModelStats = async function(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/stats`, {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const stats = await response.json();
        
        document.getElementById('modelStats').innerHTML = `
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
                <h4 class="ui header">Opérations par Type</h4>
                <div class="ui list">
                    ${Object.entries(stats.operations_by_type || {}).map(([type, count]) => `
                        <div class="item">
                            <i class="right triangle icon"></i>
                            <div class="content">
                                <div class="header">${type}</div>
                                <div class="description">${count} opération(s)</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        $('#statsModal').modal('show');
    } catch (error) {
        showMessage('Erreur', error.message, true);
    }
};

window.deleteModel = async function(modelName) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le modèle ${modelName} ?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/models/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Ollama-URL': ollamaUrl
            },
            body: JSON.stringify({ name: modelName })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Échec de la suppression du modèle');
        }
        
        showMessage('Succès', `Modèle ${modelName} supprimé avec succès`);
        refreshAll();
    } catch (error) {
        showMessage('Erreur', error.message, true);
    }
};

// Theme management
function setTheme(themeName) {
    localStorage.setItem('theme', themeName);
    document.documentElement.setAttribute('data-theme', themeName);
    const icon = document.querySelector('.theme-toggle i');
    icon.className = themeName === 'dark' ? 'moon icon' : 'sun icon';
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// Model search and pull
let searchTimeout = null;

window.searchModels = async function(input) {
    clearTimeout(searchTimeout);
    const searchResults = document.querySelector('.ui.search-results');
    const searchResultsList = document.getElementById('searchResults');
    
    if (!input.value.trim()) {
        searchResults.style.display = 'none';
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch('/api/models/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Ollama-URL': ollamaUrl
                },
                body: JSON.stringify({ keyword: input.value.trim() })
            });
            
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            searchResultsList.innerHTML = data.models.map(model => `
                <div class="item">
                    <div class="content">
                        <div class="header">${model.name}</div>
                        <div class="description">
                            ${model.tags.map(tag => `
                                <button class="ui tiny basic button" onclick="selectModel('${model.name}:${tag}')">
                                    ${tag}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `).join('');
            
            searchResults.style.display = 'block';
        } catch (error) {
            showMessage('Erreur', error.message, true);
        }
    }, 300);
};

window.selectModel = function(modelName) {
    document.getElementById('modelNameInput').value = modelName;
    document.querySelector('.ui.search-results').style.display = 'none';
};

window.pullModel = async function() {
    const modelName = document.getElementById('modelNameInput').value.trim();
    if (!modelName) {
        showMessage('Erreur', 'Veuillez entrer un nom de modèle', true);
        return;
    }

    const progress = document.getElementById('pullProgress');
    progress.style.display = 'block';
    
    try {
        const response = await fetch('/api/models/pull', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Ollama-URL': ollamaUrl
            },
            body: JSON.stringify({ name: modelName })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Échec du téléchargement du modèle');
        }
        
        const data = await response.json();
        showMessage('Succès', `Modèle ${modelName} téléchargé avec succès`);
        document.getElementById('modelNameInput').value = '';
        refreshAll();
    } catch (error) {
        showMessage('Erreur', error.message, true);
    } finally {
        progress.style.display = 'none';
    }
};

// Refresh functions
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

// Batch operations
window.toggleModelSelection = function(checkbox, modelName) {
    // This function can be used to handle individual model selection
let selectedModels = new Set();

window.selectAllModels = function(checkbox) {
    const checkboxes = document.querySelectorAll('#localModels tbody input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        const modelName = cb.getAttribute('data-model-name');
        if (checkbox.checked) {
            selectedModels.add(modelName);
        } else {
            selectedModels.delete(modelName);
        }
    });
    updateCompareButton();
};

window.toggleModelSelection = function(checkbox, modelName) {
    if (checkbox.checked) {
        selectedModels.add(modelName);
    } else {
        selectedModels.delete(modelName);
        // Décocher la case "Tous Sélectionner" si un modèle est décoché
        document.querySelector('#selectAllCheckbox').checked = false;
    }
    updateCompareButton();
};

function updateCompareButton() {
    const compareButton = document.querySelector('#compareButton');
    if (compareButton) {
        compareButton.disabled = selectedModels.size < 2;
    }
}

window.compareSelectedModels = async function() {
    if (selectedModels.size < 2) {
        showMessage('Erreur', 'Veuillez sélectionner au moins 2 modèles à comparer', true);
        return;
    }

    try {
        const modelsArray = Array.from(selectedModels);
        const comparisons = [];
        
        for (let i = 0; i < modelsArray.length; i++) {
            const modelStats = await fetch(`/api/models/${modelsArray[i]}/stats`, {
                headers: { 'X-Ollama-URL': ollamaUrl }
            }).then(res => res.json());
            
            comparisons.push({
                name: modelsArray[i],
                stats: modelStats
            });
        }

        const comparisonContent = document.getElementById('modelComparison');
        comparisonContent.innerHTML = comparisons.map(model => `
            <div class="ui segment">
                <h3 class="ui header">${model.name}</h3>
                <div class="ui statistics tiny">
                    <div class="statistic">
                        <div class="value">${model.stats.total_operations || 0}</div>
                        <div class="label">Opérations</div>
                    </div>
                    <div class="statistic">
                        <div class="value">${model.stats.total_prompt_tokens || 0}</div>
                        <div class="label">Tokens Prompt</div>
                    </div>
                    <div class="statistic">
                        <div class="value">${model.stats.total_completion_tokens || 0}</div>
                        <div class="label">Tokens Complétion</div>
                    </div>
                    <div class="statistic">
                        <div class="value">${(model.stats.total_duration || 0).toFixed(2)}s</div>
                        <div class="label">Durée</div>
                    </div>
                </div>
            </div>
        `).join('');

        $('#compareModal').modal('show');
    } catch (error) {
        showMessage('Erreur', error.message, true);
    }
};
    console.log(`Model ${modelName} ${checkbox.checked ? 'selected' : 'deselected'}`);
};

window.toggleAllModels = function() {
    const checkboxes = document.querySelectorAll('#localModels input[type="checkbox"]');
    const headerCheckbox = document.querySelector('#localModels thead input[type="checkbox"]');
    const isChecked = headerCheckbox.checked;
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
};

window.batchConfigureModels = function() {
    const selectedModels = document.querySelectorAll('input[type="checkbox"]:checked');
    if (selectedModels.length === 0) {
        showMessage('Erreur', 'Veuillez sélectionner au moins un modèle', true);
        return;
    }

    const selectedModelNames = Array.from(selectedModels).map(checkbox => checkbox.getAttribute('data-model-name'));
    
    // Update selected models list in the modal
    document.getElementById('selectedModels').innerHTML = selectedModelNames.map(name => `
        <div class="item">
            <i class="cube icon"></i>
            ${name}
        </div>
    `).join('');

    // Show the config modal
    $('#configModal').modal('show');
};

window.batchDeleteModels = async function() {
    const selectedModels = document.querySelectorAll('input[type="checkbox"]:checked');
    if (selectedModels.length === 0) {
        showMessage('Erreur', 'Veuillez sélectionner au moins un modèle', true);
        return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedModels.length} modèle(s) ?`)) {
        return;
    }

    const results = [];
    for (const checkbox of selectedModels) {
        const modelName = checkbox.getAttribute('data-model-name');
        try {
            const response = await fetch('/api/models/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Ollama-URL': ollamaUrl
                },
                body: JSON.stringify({ name: modelName })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Échec de la suppression');
            }
            
            results.push({
                model: modelName,
                success: true,
                message: 'Supprimé avec succès'
            });
        } catch (error) {
            results.push({
                model: modelName,
                success: false,
                message: error.message
            });
        }
    }

    // Show results in batch results modal
    document.getElementById('batchResults').innerHTML = results.map(result => `
        <div class="item batch-results-item ${result.success ? 'success' : 'error'}">
            <i class="${result.success ? 'check circle' : 'times circle'} icon"></i>
            <div class="content">
                <div class="header">${result.model}</div>
                <div class="description">${result.message}</div>
            </div>
        </div>
    `).join('');

    $('#batchResultsModal').modal('show');
    refreshAll();
};

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
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    checkServerStatus();
    refreshAll();
    
    // Initialize all modals
    $('.ui.modal').modal({
        closable: false
    });

    // Attacher l'événement au checkbox "Tous Sélectionner"
    const selectAllCheckbox = document.querySelector('#selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            selectAllModels(this);
        });
    }
    
    // Set up model name input events
    const modelNameInput = document.getElementById('modelNameInput');
    if (modelNameInput) {
        modelNameInput.addEventListener('input', (e) => searchModels(e.target));
        modelNameInput.addEventListener('blur', () => {
            // Delay hiding results to allow for clicks
            setTimeout(() => {
                document.querySelector('.ui.search-results').style.display = 'none';
            }, 200);
        });
    }
});

// Server status check interval
setInterval(checkServerStatus, 30000);
