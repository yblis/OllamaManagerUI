// main.js
window.App = window.App || {};

App.ollamaUrlKey = 'ollamaUrl';
App.ollamaUrl = localStorage.getItem(App.ollamaUrlKey) || 'http://localhost:11434';
App.searchCache = new Map();
App.selectedModels = new Set();

if (window.location.hostname !== 'localhost') {
    fetch('/api/server/url')
        .then(response => response.json())
        .then(data => {
            if (data.url) {
                App.ollamaUrl = data.url;
                localStorage.setItem(App.ollamaUrlKey, App.ollamaUrl);
            }
        })
        .catch(console.error);
}

App.checkServerStatus = async function() {
    try {
        const statusDot = document.getElementById('statusDot');
        if (!statusDot) return;
        const response = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': App.ollamaUrl }
        });
        if (!response.ok) {
            statusDot.className = 'status-indicator offline';
        } else {
            const data = await response.json();
            statusDot.className = 'status-indicator ' + (data.status === 'running' ? 'online' : 'offline');
        }
    } catch {
        const statusDot = document.getElementById('statusDot');
        if (statusDot) statusDot.className = 'status-indicator offline';
    }
};

App.showSettings = function() {
    document.getElementById('ollamaUrl').value = App.ollamaUrl;
    $('#settingsModal').modal('show');
};

App.saveSettings = function() {
    const newUrl = document.getElementById('ollamaUrl').value.trim();
    if (newUrl) {
        App.ollamaUrl = newUrl;
        localStorage.setItem(App.ollamaUrlKey, App.ollamaUrl);
        $('#settingsModal').modal('hide');
        App.checkServerStatus();
        App.refreshAll();
    }
};

App.showMessage = function(title, message, isError) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('messageModal').className = `ui modal ${isError ? 'negative' : 'positive'}`;
    $('#messageModal').modal('show');
};

App.escapeHTML = function(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

App.stopModel = async function(modelName) {
    if (!confirm(`Are you sure you want to stop the model ${modelName}?`)) return;
    try {
        const response = await fetch('/api/models/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Ollama-URL': App.ollamaUrl
            },
            body: JSON.stringify({ name: modelName })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to stop model');
        }
        App.showMessage('Success', `Model ${modelName} stopped successfully`);
        await App.refreshRunningModels();
    } catch (error) {
        App.showMessage('Error', error.message, true);
    }
};

App.showModelConfig = async function(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/config`, {
            headers: { 'X-Ollama-URL': App.ollamaUrl }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const config = await response.json();
        document.getElementById('selectedModels').innerHTML = `
            <div class="item">
                <i class="cube icon"></i>
                ${App.escapeHTML(modelName)}
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
                            <input type="text" value="${App.escapeHTML(key)}" readonly>
                        </div>
                        <div class="field">
                            <input type="text" value="${App.escapeHTML(value)}">
                        </div>
                    </div>
                </div>
            `;
        });
        $('#configModal').modal('show');
    } catch (error) {
        App.showMessage('Error', error.message, true);
    }
};

App.showModelStats = async function(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/stats`, {
            headers: { 'X-Ollama-URL': App.ollamaUrl }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const stats = await response.json();
        document.getElementById('modelStats').innerHTML = `
            <div class="ui statistics">
                <div class="statistic">
                    <div class="value">${stats.total_operations || 0}</div>
                    <div class="label">Total Operations</div>
                </div>
                <div class="statistic">
                    <div class="value">${stats.total_prompt_tokens || 0}</div>
                    <div class="label">Prompt Tokens</div>
                </div>
                <div class="statistic">
                    <div class="value">${stats.total_completion_tokens || 0}</div>
                    <div class="label">Completion Tokens</div>
                </div>
                <div class="statistic">
                    <div class="value">${(stats.total_duration || 0).toFixed(2)}s</div>
                    <div class="label">Total Duration</div>
                </div>
            </div>
            <div class="ui segment">
                <h4 class="ui header">Operations by Type</h4>
                <div class="ui list">
                    ${Object.entries(stats.operations_by_type || {}).map(([type, count]) => `
                        <div class="item">
                            <i class="right triangle icon"></i>
                            <div class="content">
                                <div class="header">${App.escapeHTML(type)}</div>
                                <div class="description">${count} operation(s)</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        $('#statsModal').modal('show');
    } catch (error) {
        App.showMessage('Error', error.message, true);
    }
};

App.deleteModel = async function(modelName) {
    if (!confirm(`Are you sure you want to delete the model ${modelName}?`)) return;
    try {
        const response = await fetch('/api/models/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Ollama-URL': App.ollamaUrl
            },
            body: JSON.stringify({ name: modelName })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete model');
        }
        App.showMessage('Success', `Model ${modelName} deleted successfully`);
        App.refreshAll();
    } catch (error) {
        App.showMessage('Error', error.message, true);
    }
};

App.setTheme = function(themeName) {
    localStorage.setItem('theme', themeName);
    document.documentElement.setAttribute('data-theme', themeName);
    const icon = document.querySelector('#settingsModal .ui.circular.button i');
    if (icon) {
        icon.className = themeName === 'dark' ? 'moon icon' : 'sun icon';
    }
};

App.toggleTheme = function() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    App.setTheme(newTheme);
};

App.toggleModelSelection = function(checkbox, modelName) {
    if (checkbox.checked) {
        App.selectedModels.add(modelName);
    } else {
        App.selectedModels.delete(modelName);
        document.querySelector('#selectAllCheckbox').checked = false;
    }
    App.updateCompareButton();
};

App.selectAllModels = function(checkbox) {
    const checkboxes = document.querySelectorAll('#localModels tbody input[type="checkbox"]');
    App.selectedModels.clear();
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        if (checkbox.checked) App.selectedModels.add(cb.getAttribute('data-model-name'));
    });
    App.updateCompareButton();
};

App.updateCompareButton = function() {
    const compareButton = document.querySelector('#compareButton');
    if (compareButton) {
        compareButton.disabled = App.selectedModels.size < 2;
    }
};

App.compareSelectedModels = async function() {
    if (App.selectedModels.size < 2) {
        App.showMessage('Error', 'Please select at least two models to compare', true);
        return;
    }
    try {
        const modelsArray = Array.from(App.selectedModels);
        const comparisons = [];
        for (let model of modelsArray) {
            const stats = await fetch(`/api/models/${model}/stats`, {
                headers: { 'X-Ollama-URL': App.ollamaUrl }
            }).then(res => res.json());
            comparisons.push({ name: model, stats });
        }
        const comparisonContent = document.getElementById('modelComparison');
        comparisonContent.innerHTML = comparisons.map(model => `
            <div class="ui segment">
                <h3 class="ui header">${App.escapeHTML(model.name)}</h3>
                <div class="ui statistics tiny">
                    <div class="statistic">
                        <div class="value">${model.stats.total_operations || 0}</div>
                        <div class="label">Operations</div>
                    </div>
                    <div class="statistic">
                        <div class="value">${model.stats.total_prompt_tokens || 0}</div>
                        <div class="label">Prompt Tokens</div>
                    </div>
                    <div class="statistic">
                        <div class="value">${model.stats.total_completion_tokens || 0}</div>
                        <div class="label">Completion Tokens</div>
                    </div>
                    <div class="statistic">
                        <div class="value">${(model.stats.total_duration || 0).toFixed(2)}s</div>
                        <div class="label">Duration</div>
                    </div>
                </div>
            </div>
        `).join('');
        $('#compareModal').modal('show');
    } catch (error) {
        App.showMessage('Error', error.message, true);
    }
};

App.batchDeleteModels = async function() {
    const selected = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'));
    if (selected.length === 0) {
        App.showMessage('Error', 'Please select at least one model', true);
        return;
    }
    if (!confirm(`Are you sure you want to delete ${selected.length} model(s)?`)) return;
    const results = [];
    for (let checkbox of selected) {
        const modelName = checkbox.getAttribute('data-model-name');
        try {
            const response = await fetch('/api/models/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Ollama-URL': App.ollamaUrl
                },
                body: JSON.stringify({ name: modelName })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete');
            }
            results.push({ model: modelName, success: true, message: 'Deleted successfully' });
        } catch (error) {
            results.push({ model: modelName, success: false, message: error.message });
        }
    }
    document.getElementById('batchResults').innerHTML = results.map(result => `
        <div class="item batch-results-item ${result.success ? 'success' : 'error'}">
            <i class="${result.success ? 'check circle' : 'times circle'} icon"></i>
            <div class="content">
                <div class="header">${App.escapeHTML(result.model)}</div>
                <div class="description">${App.escapeHTML(result.message)}</div>
            </div>
        </div>
    `).join('');
    $('#batchResultsModal').modal('show');
    App.refreshAll();
};

App.formatBytes = function(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

App.refreshLocalModels = async function() {
    try {
        const serverStatusResponse = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': App.ollamaUrl }
        });
        const serverStatus = await serverStatusResponse.json();
        const tbody = document.querySelector('#localModels tbody');
        if (serverStatus.status !== 'running') {
            tbody.innerHTML = '<tr><td colspan="8" class="center aligned">Ollama server not connected</td></tr>';
            return;
        }
        const response = await fetch('/api/models', {
            headers: { 'X-Ollama-URL': App.ollamaUrl }
        });
        if (!response.ok) {
            tbody.innerHTML = '<tr><td colspan="8" class="center aligned">Failed to retrieve models</td></tr>';
            return;
        }
        const data = await response.json();
        tbody.innerHTML = data.models.map(model => `
            <tr>
                <td class="collapsing">
                    <div class="ui fitted checkbox">
                        <input type="checkbox" data-model-name="${App.escapeHTML(model.name)}" onchange="App.toggleModelSelection(this, '${App.escapeHTML(model.name)}')">
                        <label></label>
                    </div>
                </td>
                <td>${App.escapeHTML(model.name)}</td>
                <td>${new Date(model.modified_at).toLocaleString()}</td>
                <td>${App.formatBytes(model.size)}</td>
                <td>${App.escapeHTML(model.details?.format || 'N/A')}</td>
                <td>${App.escapeHTML(model.details?.family || 'N/A')}</td>
                <td>${App.escapeHTML(model.details?.parameter_size || 'N/A')}</td>
                <td class="center aligned">
                    <div class="ui tiny buttons">
                        <button class="ui button" data-action="config">
                            <i class="cog icon"></i> Config
                        </button>
                        <button class="ui teal button" data-action="stats">
                            <i class="chart bar icon"></i> Stats
                        </button>
                        <button class="ui negative button" data-action="delete">
                            <i class="trash icon"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="8" class="center aligned">No models installed</td></tr>';
    } catch (error) {
        console.error('Error refreshing local models:', error);
        App.showMessage('Error', error.message, true);
    }
};

App.refreshRunningModels = async function() {
    try {
        const serverStatusResponse = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': App.ollamaUrl }
        });
        const serverStatus = await serverStatusResponse.json();
        const tbody = document.querySelector('#runningModels tbody');
        if (serverStatus.status !== 'running') {
            tbody.innerHTML = '<tr><td colspan="7" class="center aligned">Ollama server not connected</td></tr>';
            return;
        }
        const response = await fetch('/api/models/running', {
            headers: { 'X-Ollama-URL': App.ollamaUrl }
        });
        if (!response.ok) {
            tbody.innerHTML = '<tr><td colspan="7" class="center aligned">Failed to retrieve running models</td></tr>';
            return;
        }
        const data = await response.json();
        tbody.innerHTML = data.models.map(model => `
            <tr>
                <td>${App.escapeHTML(model.name)}</td>
                <td>${new Date(model.modified_at).toLocaleString()}</td>
                <td>${App.formatBytes(model.size)}</td>
                <td>${App.escapeHTML(model.details?.format || 'N/A')}</td>
                <td>${App.escapeHTML(model.details?.family || 'N/A')}</td>
                <td>${App.escapeHTML(model.details?.parameter_size || 'N/A')}</td>
                <td class="center aligned">
                    <button class="ui red tiny button" data-action="stop">
                        <i class="stop icon"></i> Stop
                    </button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7" class="center aligned">No models running</td></tr>';
    } catch (error) {
        console.error('Error refreshing running models:', error);
        App.showMessage('Error', error.message, true);
    }
};

App.refreshStats = async function() {
    try {
        const statsElement = document.getElementById('overallStats');
        if (!statsElement) return;
        const response = await fetch('/api/models/stats', {
            headers: { 'X-Ollama-URL': App.ollamaUrl }
        });
        if (!response.ok) throw new Error('Failed to fetch stats');
        const stats = await response.json();
        statsElement.innerHTML = `
            <div class="statistic">
                <div class="value">${stats.total_operations || 0}</div>
                <div class="label">Total Operations</div>
            </div>
            <div class="statistic">
                <div class="value">${stats.total_prompt_tokens || 0}</div>
                <div class="label">Prompt Tokens</div>
            </div>
            <div class="statistic">
                <div class="value">${stats.total_completion_tokens || 0}</div>
                <div class="label">Completion Tokens</div>
            </div>
            <div class="statistic">
                <div class="value">${(stats.total_duration || 0).toFixed(2)}s</div>
                <div class="label">Total Duration</div>
            </div>
        `;
    } catch (error) {
        console.error('Error refreshing stats:', error);
    }
};

App.refreshAll = function() {
    App.refreshLocalModels();
    App.refreshRunningModels();
    App.refreshStats();
    App.checkServerStatus();
};

App.addParameter = function() {
    const parametersList = document.querySelector('.parameters-list');
    const newItem = document.createElement('div');
    newItem.className = 'parameter-item';
    newItem.innerHTML = `
        <div class="ui fluid input">
            <input type="text" placeholder="Key" class="param-key" />
        </div>
        <div class="ui fluid input">
            <input type="text" placeholder="Value" class="param-value" />
        </div>
        <button class="ui icon button red" onclick="App.removeParameter(this)">
            <i class="trash icon"></i>
        </button>
    `;
    parametersList.appendChild(newItem);
};

App.removeParameter = function(button) {
    button.parentElement.remove();
};

App.saveModelConfig = async function() {
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
                    'X-Ollama-URL': App.ollamaUrl
                },
                body: JSON.stringify({
                    system: systemPrompt,
                    template: template,
                    parameters: parameters
                })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save configuration');
            }
            App.showMessage('Success', `Configuration for model ${modelName} saved successfully`);
        } catch (error) {
            App.showMessage('Error', `Error saving configuration for ${modelName}: ${error.message}`, true);
            return;
        }
    }
    $('#configModal').modal('hide');
    App.refreshAll();
};

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    App.setTheme(savedTheme);
    App.refreshAll();
    $('.ui.modal').modal({ closable: false });

    const selectAllCheckbox = document.querySelector('#selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            App.selectAllModels(this);
        });
    }

    const modelNameInput = document.getElementById('modelNameInput');
    if (modelNameInput) {
        modelNameInput.addEventListener('input', (e) => {
            if (!e.target.value.trim()) {
                const searchResults = document.querySelector('.ui.search-results');
                if (searchResults) {
                    searchResults.style.display = 'none';
                }
            }
        });
        modelNameInput.addEventListener('blur', () => {
            setTimeout(() => {
                const searchResults = document.querySelector('.ui.search-results');
                if (searchResults) searchResults.style.display = 'none';
            }, 200);
        });
    }

    document.getElementById('searchResults').addEventListener('click', function(event) {
        if (event.target.matches('button.ui.button')) {
            const modelName = event.target.getAttribute('data-model');
            App.selectModel(modelName);
        }
    });

    document.getElementById('localModels').addEventListener('click', function(event) {
        const button = event.target.closest('button.ui.button');
        if (!button) return;
        const action = button.getAttribute('data-action');
        const modelName = button.closest('tr').querySelector('td:nth-child(2)').textContent;
        switch(action) {
            case 'config':
                App.showModelConfig(modelName);
                break;
            case 'stats':
                App.showModelStats(modelName);
                break;
            case 'delete':
                App.deleteModel(modelName);
                break;
            case 'stop':
                App.stopModel(modelName);
                break;
        }
    });
});