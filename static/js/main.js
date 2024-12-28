// Server status check
let ollamaUrl = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
let currentLang = localStorage.getItem('language') || 'fr';
let searchTimeout = null;
let selectedModels = new Set();

// Global functions
function showSettings() {
    document.getElementById('ollamaUrl').value = ollamaUrl;
    document.getElementById('languageSelect').value = currentLang;
    $('#settingsModal').modal('show');
}

function saveSettings() {
    const newUrl = document.getElementById('ollamaUrl').value.trim();
    const newLang = document.getElementById('languageSelect').value;

    if (newUrl) {
        ollamaUrl = newUrl;
        localStorage.setItem('ollamaUrl', ollamaUrl);
    }

    if (newLang !== currentLang) {
        changeLanguage(newLang);
    }

    $('#settingsModal').modal('hide');
    checkServerStatus();
    refreshAll();
}

// Language management
function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('language', lang);
    document.documentElement.setAttribute('lang', lang);

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key) {
            if (element.tagName === 'INPUT' && element.getAttribute('type') === 'text') {
                element.placeholder = translations[lang][key] || key;
            } else {
                element.textContent = translations[lang][key] || key;
            }
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Set initial language
    const savedLang = localStorage.getItem('language') || 'fr';
    changeLanguage(savedLang);

    // Initialize UI components
    $('.ui.dropdown').dropdown();
    $('#languageSelect').val(savedLang);

    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    // Start normal initialization
    refreshAll();
    setInterval(refreshAll, 30000);

    // Initialize all modals
    $('.ui.modal').modal({
        closable: false
    });

    // Initialize model name input events
    const modelNameInput = document.getElementById('modelNameInput');
    if (modelNameInput) {
        modelNameInput.addEventListener('input', (e) => searchModels(e.target));
        modelNameInput.addEventListener('blur', () => {
            setTimeout(() => {
                document.querySelector('.ui.search-results').style.display = 'none';
            }, 200);
        });
    }

    // Initialize server status check
    checkServerStatus();
    setInterval(checkServerStatus, 30000);
});

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

// Server status check
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
    } catch (error) {
        const statusDot = document.getElementById('statusDot');
        if (statusDot) {
            statusDot.className = 'status-indicator offline';
        }
    }
}

// Message display
function showMessage(title, message, isError = false) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('messageModal').className = `ui modal ${isError ? 'negative' : 'positive'}`;
    $('#messageModal').modal('show');
}

// Model search and selection
async function searchModels(input) {
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
}

function selectModel(modelName) {
    document.getElementById('modelNameInput').value = modelName;
    document.querySelector('.ui.search-results').style.display = 'none';
}

// Model management functions
async function pullModel() {
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
}

// Model operations
async function stopModel(modelName) {
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
        await refreshRunningModels();
    } catch (error) {
        showMessage('Erreur', error.message, true);
    }
}

async function deleteModel(modelName) {
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
}

// Model configuration
async function showModelConfig(modelName) {
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
}

async function saveModelConfig() {
    const selectedModels = document.querySelectorAll('#selectedModels .item');
    const systemPrompt = document.getElementById('systemPrompt').value;
    const template = document.getElementById('template').value;

    const parameters = {};
    document.querySelectorAll('#parameters .ui.segment').forEach(segment => {
        const inputs = segment.querySelectorAll('input');
        if (inputs.length === 2) {
            const key = inputs[0].value.trim();
            const value = inputs[1].value.trim();
            if (key && value) {
                parameters[key] = value;
            }
        }
    });

    for (const modelDiv of selectedModels) {
        const modelName = modelDiv.textContent.trim();
        try {
            const response = await fetch(`/api/models/${modelName}/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Ollama-URL': ollamaUrl
                },
                body: JSON.stringify({
                    system: systemPrompt,
                    template: template,
                    parameters: parameters
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Échec de la sauvegarde de la configuration');
            }

            showMessage('Succès', `Configuration du modèle ${modelName} sauvegardée avec succès`);
        } catch (error) {
            showMessage('Erreur', `Erreur lors de la sauvegarde de la configuration pour ${modelName}: ${error.message}`, true);
            return;
        }
    }

    $('#configModal').modal('hide');
    refreshAll();
}

// Batch operations
function toggleModelSelection(checkbox, modelName) {
    if (checkbox.checked) {
        selectedModels.add(modelName);
    } else {
        selectedModels.delete(modelName);
        document.querySelector('#selectAllCheckbox').checked = false;
    }
    updateCompareButton();
}

function selectAllModels(checkbox) {
    const checkboxes = document.querySelectorAll('#localModels tbody input[type="checkbox"]');
    const isChecked = checkbox.checked;

    selectedModels.clear();

    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const modelName = cb.getAttribute('data-model-name');
        if (isChecked) {
            selectedModels.add(modelName);
        }
    });

    updateCompareButton();
}

function updateCompareButton() {
    const compareButton = document.querySelector('#compareButton');
    if (compareButton) {
        compareButton.disabled = selectedModels.size < 2;
    }
}

// Refresh functions
async function refreshLocalModels() {
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
}

async function refreshRunningModels() {
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
}

async function refreshAll() {
    await Promise.all([
        refreshLocalModels(),
        refreshRunningModels()
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

// Expose functions to window object
window.showSettings = showSettings;
window.saveSettings = saveSettings;
window.toggleTheme = toggleTheme;
window.searchModels = searchModels;
window.selectModel = selectModel;
window.pullModel = pullModel;
window.stopModel = stopModel;
window.deleteModel = deleteModel;
window.showModelConfig = showModelConfig;
window.saveModelConfig = saveModelConfig;
window.toggleModelSelection = toggleModelSelection;
window.selectAllModels = selectAllModels;
window.refreshLocalModels = refreshLocalModels;
window.refreshRunningModels = refreshRunningModels;
window.refreshAll = refreshAll;