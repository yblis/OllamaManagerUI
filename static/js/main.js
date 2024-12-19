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
        const statusDot = document.getElementById('statusDot');
        if (!statusDot) return;
        
        const response = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        
        if (!response.ok) {
            statusDot.className = 'status-indicator offline';
            return;
        }
        
        const data = await response.json();
        statusDot.className = 'status-indicator ' + (data.status === 'running' ? 'online' : 'offline');
        
        // Update status check interval
        setTimeout(checkServerStatus, 5000);
    } catch (error) {
        const statusDot = document.getElementById('statusDot');
        if (statusDot) {
            statusDot.className = 'status-indicator offline';
        }
        setTimeout(checkServerStatus, 5000);
    }
}

// Start status checking when page loads
document.addEventListener('DOMContentLoaded', checkServerStatus);

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
    const icon = document.querySelector('#settingsModal .ui.circular.button i');
    if (icon) {
        icon.className = themeName === 'dark' ? 'moon icon' : 'sun icon';
    }
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
        const serverStatusResponse = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        const serverStatus = await serverStatusResponse.json();
        
        if (serverStatus.status !== 'running') {
            const tbody = document.querySelector('#localModels tbody');
            tbody.innerHTML = '<tr><td colspan="8" class="center aligned">Serveur Ollama non connecté</td></tr>';
            return;
        }

        const response = await fetch('/api/models', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) {
            const tbody = document.querySelector('#localModels tbody');
            tbody.innerHTML = '<tr><td colspan="8" class="center aligned">Impossible de récupérer les modèles</td></tr>';
            return;
        }
        
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
        const serverStatusResponse = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        const serverStatus = await serverStatusResponse.json();
        
        if (serverStatus.status !== 'running') {
            const tbody = document.querySelector('#runningModels tbody');
            tbody.innerHTML = '<tr><td colspan="7" class="center aligned">Serveur Ollama non connecté</td></tr>';
            return;
        }

        const response = await fetch('/api/models/running', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) {
            const tbody = document.querySelector('#runningModels tbody');
            tbody.innerHTML = '<tr><td colspan="7" class="center aligned">Impossible de récupérer les modèles en cours d\'exécution</td></tr>';
            return;
        }
        
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

// Show settings modal
window.showSettings = function() {
    $('#settingsModal').modal('show');
};

// Toggle theme function
window.toggleTheme = function() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update theme button icon
    const themeIcon = document.querySelector('.theme-toggle i');
    if (themeIcon) {
        themeIcon.className = newTheme === 'dark' ? 'moon icon' : 'sun icon';
    }
};

// Toggle all model checkboxes
window.toggleAllModels = function() {
    const checkboxes = document.querySelectorAll('#localModels tbody input[type="checkbox"]');
    const masterCheckbox = document.querySelector('#localModels thead input[type="checkbox"]');
    const isChecked = masterCheckbox.checked;
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        if (checkbox.dataset.modelName) {
            toggleModelSelection(checkbox, checkbox.dataset.modelName);
        }
    });
};

// Compare selected models
window.compareSelectedModels = function() {
    const selectedCheckboxes = document.querySelectorAll('#localModels tbody input[type="checkbox"]:checked');
    const selectedModels = Array.from(selectedCheckboxes).map(checkbox => checkbox.dataset.modelName);
    
    if (selectedModels.length < 2) {
        showMessage('Erreur', 'Veuillez sélectionner au moins deux modèles à comparer', true);
        return;
    }
    
    // Populate comparison modal
    const comparisonContainer = document.getElementById('modelComparison');
    comparisonContainer.innerHTML = selectedModels.map(model => `
        <div class="eight wide column">
            <div class="ui segment">
                <h3 class="ui header">${model}</h3>
                <div class="ui list model-details" id="details-${model}">
                    <div class="item">Chargement des détails...</div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Show the modal
    $('#comparisonModal').modal('show');
    
    // Fetch and display details for each model
    selectedModels.forEach(async (model) => {
        try {
            const response = await fetch(`/api/models/${model}/details`, {
                headers: { 'X-Ollama-URL': ollamaUrl }
            });
            const details = await response.json();
            
            document.getElementById(`details-${model}`).innerHTML = `
                <div class="item">
                    <div class="header">Format</div>
                    <div class="description">${details.format || 'N/A'}</div>
                </div>
                <div class="item">
                    <div class="header">Famille</div>
                    <div class="description">${details.family || 'N/A'}</div>
                </div>
                <div class="item">
                    <div class="header">Taille des paramètres</div>
                    <div class="description">${details.parameter_size || 'N/A'}</div>
                </div>
            `;
        } catch (error) {
            document.getElementById(`details-${model}`).innerHTML = `
                <div class="item error-message">
                    Erreur lors du chargement des détails : ${error.message}
                </div>
            `;
        }
    });
};

// Format bytes to human readable size
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Refresh all data
function refreshAll() {
    refreshLocalModels();
    refreshRunningModels();
    refreshStats();
    checkServerStatus();
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    refreshAll();
    // Check status and refresh data every 30 seconds
    setInterval(refreshAll, 30000);
});
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
    const isChecked = checkbox.checked;
    
    selectedModels.clear(); // Réinitialiser la sélection
    
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const modelName = cb.getAttribute('data-model-name');
        if (isChecked) {
            selectedModels.add(modelName);
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
// Fonction pour ajouter un paramètre dans la modale de configuration
// Fonction pour sauvegarder la configuration du modèle
window.saveModelConfig = async function() {
    const selectedModels = document.querySelectorAll('#selectedModels .item');
    const systemPrompt = document.getElementById('systemPrompt').value;
    const template = document.getElementById('template').value;
    const parameterItems = document.querySelectorAll('.parameter-item');
    
    const parameters = {};
    parameterItems.forEach(item => {
        const key = item.querySelector('.param-key').value;
        const value = item.querySelector('.param-value').value;
        if (key && value) {
            parameters[key] = value;
        }
    });

    const results = [];
    for (const modelDiv of selectedModels) {
        const modelName = modelDiv.textContent.trim();
        try {
            const response = await fetch('/api/models/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Ollama-URL': ollamaUrl
                },
                body: JSON.stringify({
                    name: modelName,
                    system: systemPrompt,
                    template: template,
                    parameters: parameters
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Échec de la mise à jour de la configuration');
            }

            results.push({
                model: modelName,
                success: true,
                message: 'Configuration mise à jour avec succès'
            });
        } catch (error) {
            results.push({
                model: modelName,
                success: false,
                message: error.message
            });
        }
    }

    // Afficher un message de résultat
    const allSuccess = results.every(r => r.success);
    
    // Créer un message de notification
    const message = document.createElement('div');
    message.className = `ui message ${allSuccess ? 'positive' : 'negative'}`;
    message.innerHTML = results.map(result => `
        <div class="item">
            <i class="${result.success ? 'check circle' : 'times circle'} icon"></i>
            <div class="content">
                <div class="header">${result.model}</div>
                <div class="description">${result.message}</div>
            </div>
        </div>
    `).join('');
    
    // Ajouter le message à la page
    const container = document.querySelector('.ui.container');
    container.insertBefore(message, container.firstChild);
    
    // Fermer la modale et rafraîchir les données
    $('#configModal').modal('hide');
    
    // Supprimer le message après 5 secondes
    setTimeout(() => message.remove(), 5000);
    
    // Rafraîchir la liste des modèles
    refreshAll();
};

window.addParameter = function() {
    const parametersList = document.querySelector('.parameters-list');
    const newItem = document.createElement('div');
    newItem.className = 'ui segment parameter-item';
    
    newItem.innerHTML = `
        <div class="ui two fields">
            <div class="field">
                <div class="ui fluid input">
                    <input type="text" placeholder="Clé" class="param-key" />
                </div>
            </div>
            <div class="field">
                <div class="ui fluid input">
                    <input type="text" placeholder="Valeur" class="param-value" />
                </div>
            </div>
        </div>
        <button class="ui right floated icon button red tiny" onclick="this.closest('.parameter-item').remove()">
            <i class="trash icon"></i>
        </button>
        <div class="clearfix"></div>
    `;
    
    parametersList.appendChild(newItem);
};

// Server status check interval
setInterval(checkServerStatus, 30000);
