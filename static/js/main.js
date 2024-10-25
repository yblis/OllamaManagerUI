// Refresh intervals
const REFRESH_INTERVAL = 5000; // 5 seconds

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    refreshAll();
    setInterval(checkServerStatus, 5000);
});

// Server status check
function checkServerStatus() {
    fetch('/api/server/status')
        .then(response => response.json())
        .then(data => {
            const statusDiv = document.getElementById('serverStatus');
            statusDiv.className = `ui message ${data.status === 'running' ? 'positive' : 'negative'}`;
            statusDiv.innerHTML = `
                <i class="icon ${data.status === 'running' ? 'check circle' : 'times circle'}"></i>
                <span>Ollama server is ${data.status === 'running' ? 'running' : 'not running'}</span>
            `;
        })
        .catch(error => console.error('Error checking server status:', error));
}

// Refresh all data
function refreshAll() {
    refreshModels();
    refreshStats();
}

// Refresh models
async function refreshModels() {
    try {
        // Get local models
        const localResponse = await fetch('/api/models');
        const localData = await localResponse.json();
        if (!localResponse.ok) throw new Error(localData.error || 'Failed to fetch local models');
        displayModels(localData.models || [], 'localModels');
        
        // Get running models
        const runningResponse = await fetch('/api/models/running');
        const runningData = await runningResponse.json();
        if (!runningResponse.ok) throw new Error(runningData.error || 'Failed to fetch running models');
        displayModels(runningData.models || [], 'runningModels');
    } catch (error) {
        console.error('Error refreshing models:', error);
        displayModels([], 'localModels', error.message);
        displayModels([], 'runningModels', error.message);
    }
}

// Refresh statistics
async function refreshStats() {
    try {
        const response = await fetch('/api/models/stats');
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to fetch statistics');
        
        const statsContainer = document.getElementById('overallStats');
        statsContainer.innerHTML = `
            <div class="ui statistic">
                <div class="value">${data.total_operations}</div>
                <div class="label">Total Operations</div>
            </div>
            <div class="ui statistic">
                <div class="value">${data.total_prompt_tokens}</div>
                <div class="label">Prompt Tokens</div>
            </div>
            <div class="ui statistic">
                <div class="value">${data.total_completion_tokens}</div>
                <div class="label">Completion Tokens</div>
            </div>
            <div class="ui statistic">
                <div class="value">${formatDuration(data.total_duration)}</div>
                <div class="label">Total Duration</div>
            </div>
        `;
    } catch (error) {
        console.error('Error fetching statistics:', error);
    }
}

// Model operations
async function pullModel() {
    const modelName = document.getElementById('modelNameInput').value.trim();
    if (!modelName) {
        showMessage('Error', 'Please enter a model name', true);
        return;
    }

    try {
        const response = await fetch('/api/models/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to pull model');
        
        showMessage('Success', `Successfully pulled model ${modelName}`);
        document.getElementById('modelNameInput').value = '';
        refreshModels();
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

async function deleteModel(modelName) {
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) return;
    
    try {
        const response = await fetch('/api/models/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to delete model');
        
        showMessage('Success', `Successfully deleted model ${modelName}`);
        refreshModels();
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

// Display models in table format
function displayModels(models, containerId, errorMessage = null) {
    const container = document.getElementById(containerId);
    const tbody = container.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (errorMessage) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="ui warning message">${errorMessage}</div></td></tr>`;
        return;
    }
    
    if (models.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="ui message">No models found</div></td></tr>';
        return;
    }
    
    for (const model of models) {
        const tr = document.createElement('tr');
        
        // Add checkbox column for local models
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
                    <button class="ui primary button" onclick="showModelStats('${model.name}')">
                        <i class="chart bar icon"></i> Stats
                    </button>
                    <button class="ui teal button" onclick="showModelConfig('${model.name}')">
                        <i class="cog icon"></i> Config
                    </button>
                    <button class="ui negative button" onclick="deleteModel('${model.name}')">
                        <i class="trash icon"></i> Delete
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    }

    // Initialize checkboxes
    $('.ui.checkbox').checkbox();
}

// Batch operations
function toggleAllModels() {
    const checkboxes = document.querySelectorAll('#localModels input[type="checkbox"]');
    const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
    checkboxes.forEach(cb => cb.checked = anyUnchecked);
}

function getSelectedModels() {
    const checkboxes = document.querySelectorAll('#localModels input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.model);
}

async function batchDeleteModels() {
    const selectedModels = getSelectedModels();
    if (selectedModels.length === 0) {
        showMessage('Error', 'Please select at least one model to delete', true);
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedModels.length} selected models?`)) return;
    
    try {
        const response = await fetch('/api/models/batch/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names: selectedModels })
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to delete models');
        
        displayBatchResults(data.results);
        refreshModels();
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

async function batchConfigureModels() {
    const selectedModels = getSelectedModels();
    if (selectedModels.length === 0) {
        showMessage('Error', 'Please select at least one model to configure', true);
        return;
    }

    document.getElementById('selectedModels').innerHTML = selectedModels.map(model => `
        <div class="item">
            <i class="cog icon"></i>
            <div class="content">${model}</div>
        </div>
    `).join('');

    document.getElementById('systemPrompt').value = '';
    document.getElementById('template').value = '';
    document.getElementById('parameters').innerHTML = '';

    $('#configModal').modal('show');
}

// Model configuration
async function showModelConfig(modelName) {
    try {
        const response = await fetch(`/api/models/config?name=${encodeURIComponent(modelName)}`);
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to fetch model configuration');
        
        document.getElementById('selectedModels').innerHTML = `
            <div class="item">
                <i class="cog icon"></i>
                <div class="content">${modelName}</div>
            </div>
        `;
        
        document.getElementById('systemPrompt').value = data.system || '';
        document.getElementById('template').value = data.template || '';
        
        const parametersDiv = document.getElementById('parameters');
        parametersDiv.innerHTML = '';
        
        Object.entries(data.parameters || {}).forEach(([key, value]) => {
            parametersDiv.appendChild(createParameterSegment(key, value));
        });
        
        $('#configModal').modal('show');
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

function createParameterSegment(key = '', value = '') {
    const segment = document.createElement('div');
    segment.className = 'ui segment parameter-segment';
    
    segment.innerHTML = `
        <div class="two fields">
            <div class="field">
                <input type="text" class="parameter-key" placeholder="Parameter name" value="${key}">
            </div>
            <div class="field">
                <div class="ui action input">
                    <input type="text" class="parameter-value" placeholder="Parameter value" value="${value}">
                    <button class="ui negative icon button" onclick="removeParameter(this)">
                        <i class="trash icon"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return segment;
}

function addParameter() {
    const parametersDiv = document.getElementById('parameters');
    parametersDiv.appendChild(createParameterSegment());
}

function removeParameter(button) {
    button.closest('.parameter-segment').remove();
}

async function saveModelConfig() {
    try {
        const parameters = {};
        document.querySelectorAll('.parameter-segment').forEach(segment => {
            const key = segment.querySelector('.parameter-key').value.trim();
            const value = segment.querySelector('.parameter-value').value.trim();
            if (key && value) {
                parameters[key] = value;
            }
        });

        const config = {
            system: document.getElementById('systemPrompt').value.trim(),
            template: document.getElementById('template').value.trim(),
            parameters: parameters
        };

        const selectedModels = getSelectedModels();
        
        const response = await fetch('/api/models/batch/update_config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                models: selectedModels,
                config: config
            })
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to update configuration');
        
        $('#configModal').modal('hide');
        displayBatchResults(data.results);
        refreshModels();
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

// Model statistics
async function showModelStats(modelName) {
    try {
        const response = await fetch(`/api/models/stats?name=${encodeURIComponent(modelName)}`);
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to fetch model statistics');
        
        const statsDiv = document.getElementById('modelStats');
        statsDiv.innerHTML = `
            <div class="ui statistics">
                <div class="statistic">
                    <div class="value">${data.total_operations}</div>
                    <div class="label">Total Operations</div>
                </div>
                <div class="statistic">
                    <div class="value">${data.total_prompt_tokens}</div>
                    <div class="label">Prompt Tokens</div>
                </div>
                <div class="statistic">
                    <div class="value">${data.total_completion_tokens}</div>
                    <div class="label">Completion Tokens</div>
                </div>
                <div class="statistic">
                    <div class="value">${formatDuration(data.total_duration)}</div>
                    <div class="label">Total Duration</div>
                </div>
            </div>
            <div class="ui segment">
                <h4 class="ui header">Operations by Type</h4>
                <div class="ui list">
                    ${Object.entries(data.operations_by_type || {})
                        .map(([type, count]) => `
                            <div class="item">
                                <i class="right triangle icon"></i>
                                <div class="content">
                                    <div class="header">${type}</div>
                                    <div class="description">${count} operations</div>
                                </div>
                            </div>
                        `).join('')}
                </div>
            </div>
        `;
        
        $('#statsModal').modal('show');
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

// Settings functions
function showSettings() {
    const ollamaUrl = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
    document.getElementById('ollamaUrl').value = ollamaUrl;
    $('#settingsModal').modal('show');
}

async function saveSettings() {
    const ollamaUrl = document.getElementById('ollamaUrl').value.trim();
    if (!ollamaUrl) {
        showMessage('Error', 'Please enter the Ollama server URL', true);
        return;
    }
    
    try {
        localStorage.setItem('ollamaUrl', ollamaUrl);
        $('#settingsModal').modal('hide');
        showMessage('Success', 'Settings saved successfully');
        refreshAll();
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

// Utility functions
function showMessage(title, message, isError = false) {
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalMessage.className = isError ? 'error-message' : 'success-message';
    
    $('#messageModal').modal('show');
}

function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
    if (seconds < 60) return `${seconds.toFixed(2)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(2);
    return `${minutes}m ${remainingSeconds}s`;
}

function displayBatchResults(results) {
    const resultsDiv = document.getElementById('batchResults');
    resultsDiv.innerHTML = results.map(result => `
        <div class="batch-results-item ${result.success ? 'success' : 'error'}">
            <i class="icon ${result.success ? 'check circle' : 'times circle'}"></i>
            <div class="content">
                <div class="header">${result.name}</div>
                <div class="description">${result.message}</div>
            </div>
        </div>
    `).join('');

    $('#batchResultsModal').modal('show');
}

// Initialize modals
$('.ui.modal').modal();
