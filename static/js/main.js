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
        if (!statusElement) return;

        if (data.status === 'running') {
            statusElement.className = 'flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-800';
            statusElement.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Le serveur Ollama est en cours d\'exécution';
        } else {
            statusElement.className = 'flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-800';
            statusElement.innerHTML = '<i class="fas fa-times-circle mr-2"></i>Le serveur Ollama est arrêté';
        }
    } catch (error) {
        console.error('Error checking server status:', error);
        const statusElement = document.getElementById('serverStatus');
        if (!statusElement) return;
        
        statusElement.className = 'flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-800';
        statusElement.innerHTML = '<i class="fas fa-times-circle mr-2"></i>Erreur de connexion au serveur';
    }
}

// Modal management
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

// Settings management
window.showSettings = function() {
    const urlInput = document.getElementById('ollamaUrl');
    if (urlInput) {
        urlInput.value = ollamaUrl;
    }
    showModal('settingsModal');
};

window.closeConfigModal = function() {
    closeModal('configModal');
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
        const tbody = document.getElementById('runningModels');
        if (!tbody) return;
        
        tbody.innerHTML = data.models.map(model => `
            <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <td class="py-4 px-6">${model.name}</td>
                <td class="py-4 px-6">${new Date(model.modified_at).toLocaleString()}</td>
                <td class="py-4 px-6">${formatBytes(model.size)}</td>
                <td class="py-4 px-6">${model.details?.format || 'N/A'}</td>
                <td class="py-4 px-6">${model.details?.family || 'N/A'}</td>
                <td class="py-4 px-6">${model.details?.parameter_size || 'N/A'}</td>
                <td class="py-4 px-6 text-center">
                    <button 
                        class="btn-danger inline-flex items-center px-3 py-2"
                        onclick="stopModel('${model.name}')"
                    >
                        <i class="fas fa-stop mr-2"></i> Arrêter
                    </button>
                </td>
            </tr>
        `).join('') || `
            <tr class="bg-white dark:bg-gray-800">
                <td colspan="7" class="py-4 px-6 text-center text-gray-500 dark:text-gray-400">
                    Aucun modèle en cours d'exécution
                </td>
            </tr>`;
    } catch (error) {
        console.error('Error refreshing running models:', error);
        showMessage('Erreur', error.message || 'Erreur lors de l\'actualisation des modèles en cours d\'exécution', true);
    }
};

async function refreshStats() {
    try {
        const response = await fetch('/api/models/stats', {
// Modal comparison functions
window.closeComparisonModal = function() {
    document.getElementById('comparisonModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
};

window.compareSelectedModels = async function() {
    const selectedModels = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.getAttribute('data-model-name'))
        .filter(Boolean);

    if (selectedModels.length < 2) {
        showMessage('Erreur', 'Veuillez sélectionner au moins 2 modèles à comparer', true);
        return;
    }

    try {
        const comparisons = await Promise.all(selectedModels.map(async (modelName) => {
            const response = await fetch(`/api/models/${modelName}/stats`, {
                headers: { 'X-Ollama-URL': ollamaUrl }
            });
            const stats = await response.json();
            return { modelName, stats };
        }));

        document.getElementById('modelComparison').innerHTML = comparisons.map(({ modelName, stats }) => `
            <div class="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm animate-fade-in">
                <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">${modelName}</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">${stats.total_operations || 0}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Opérations</div>
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">${stats.total_prompt_tokens || 0}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Tokens Prompt</div>
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">${stats.total_completion_tokens || 0}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Tokens Complétion</div>
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">${(stats.total_duration || 0).toFixed(2)}s</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Durée Totale</div>
                    </div>
                </div>
            </div>
        `).join('');

        document.getElementById('comparisonModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } catch (error) {
        showMessage('Erreur', error.message, true);
    }
};
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
