// Refresh intervals
const REFRESH_INTERVAL = 5000; // 5 seconds

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    refreshAll();
    setInterval(refreshAll, REFRESH_INTERVAL);
});

// Show message in modal
function showMessage(title, message, isError = false) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('modalMessage').className = isError ? 'error-message' : 'success-message';
    $('.ui.modal#messageModal').modal('show');
}

// Format file size
function formatSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

// Format duration
function formatDuration(seconds) {
    if (seconds < 60) return `${seconds.toFixed(2)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(2);
    return `${minutes}m ${remainingSeconds}s`;
}

// Handle server error
function handleServerError() {
    const statusDiv = document.getElementById('serverStatus');
    statusDiv.className = 'ui message negative';
    statusDiv.innerHTML = `
        <i class="icon times circle"></i>
        <span>Ollama server is not running</span>
        <div class="ui warning message" style="margin-top: 1rem;">
            <div class="header">Server Not Running</div>
            <p>Please ensure Ollama is installed and running on your system. You can download it from <a href="https://ollama.ai" target="_blank">ollama.ai</a>.</p>
            <p>Once installed, start the Ollama server before using this interface.</p>
        </div>
    `;
}

// Refresh everything
async function refreshAll() {
    try {
        const serverStatus = await checkServerStatus();
        if (!serverStatus) {
            handleServerError();
            return;
        }
        await refreshModels();
        await refreshOverallStats();
    } catch (error) {
        console.error('Error refreshing data:', error);
        handleServerError();
    }
}

// Check server status
async function checkServerStatus() {
    try {
        const response = await fetch('/api/server/status');
        const data = await response.json();
        
        const statusDiv = document.getElementById('serverStatus');
        const icon = statusDiv.querySelector('i');
        const text = statusDiv.querySelector('span');
        
        if (data.status === 'running') {
            statusDiv.className = 'ui message positive';
            icon.className = 'icon check circle';
            text.textContent = 'Ollama server is running';
            return true;
        } else {
            handleServerError();
            return false;
        }
    } catch (error) {
        console.error('Error checking server status:', error);
        handleServerError();
        return false;
    }
}

// Refresh overall stats
async function refreshOverallStats() {
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
        console.error('Error fetching overall stats:', error);
    }
}

// Show model stats
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
                    ${Object.entries(data.operations_by_type)
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

// Get selected model names
function getSelectedModels() {
    return Array.from(document.querySelectorAll('.model-checkbox input:checked'))
        .map(checkbox => checkbox.getAttribute('data-model'));
}

// Toggle all model checkboxes
function toggleAllModels() {
    const checkboxes = document.querySelectorAll('.model-checkbox input');
    const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
    checkboxes.forEach(cb => cb.checked = anyUnchecked);
}

// Batch delete models
async function batchDeleteModels() {
    const selectedModels = getSelectedModels();
    if (selectedModels.length === 0) {
        showMessage('Error', 'Please select at least one model to delete', true);
        return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedModels.length} selected models?`)) {
        return;
    }

    try {
        const response = await fetch('/api/models/batch/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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

// Batch configure models
async function batchConfigureModels() {
    const selectedModels = getSelectedModels();
    if (selectedModels.length === 0) {
        showMessage('Error', 'Please select at least one model to configure', true);
        return;
    }

    currentModel = null; // Clear single model selection
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

// Save batch model configuration
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

        const selectedModels = currentModel ? [currentModel] : getSelectedModels();
        
        if (selectedModels.length === 0) {
            throw new Error('No models selected');
        }

        const response = await fetch('/api/models/batch/update_config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                models: selectedModels,
                config: config
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update model configuration');

        $('#configModal').modal('hide');
        displayBatchResults(data.results);
        refreshModels();
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

// Display batch operation results
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

// Refresh models
async function refreshModels() {
    try {
        const serverStatus = await checkServerStatus();
        if (!serverStatus) {
            return;
        }

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
        if (error.message.includes('Ollama server is not running')) {
            handleServerError();
        } else {
            displayModels([], 'localModels', error.message);
            displayModels([], 'runningModels', error.message);
        }
    }
}

// Display models
function displayModels(models, containerId, errorMessage = null) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (errorMessage) {
        container.innerHTML = `<div class="ui warning message">${errorMessage}</div>`;
        return;
    }
    
    if (models.length === 0) {
        container.innerHTML = '<div class="ui message">No models found</div>';
        return;
    }
    
    models.forEach(model => {
        const card = document.createElement('div');
        card.className = 'ui card model-card';
        
        // Add checkbox for model selection in local models
        const checkbox = containerId === 'localModels' ? `
            <div class="model-checkbox">
                <div class="ui checkbox">
                    <input type="checkbox" data-model="${model.name}">
                    <label></label>
                </div>
            </div>
        ` : '';
        
        card.innerHTML = `
            ${checkbox}
            <div class="content">
                <div class="header">${model.name}</div>
                <div class="meta">${model.modified_at}</div>
                <div class="model-details">
                    <div>Size: <span class="model-size">${formatSize(model.size)}</span></div>
                    ${model.details ? `
                        <div>Format: ${model.details.format}</div>
                        <div>Family: ${model.details.family}</div>
                        <div>Parameters: ${model.details.parameter_size}</div>
                    ` : ''}
                </div>
            </div>
            <div class="extra content">
                <div class="ui three buttons">
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
            </div>
        `;
        
        container.appendChild(card);
    });

    // Initialize checkboxes
    $('.ui.checkbox').checkbox();
}

// Pull model
async function pullModel() {
    const modelName = document.getElementById('modelNameInput').value.trim();
    
    if (!modelName) {
        showMessage('Error', 'Please enter a model name', true);
        return;
    }
    
    try {
        const response = await fetch('/api/models/pull', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: modelName })
        });
        
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to pull model');
        
        showMessage('Success', `Successfully pulled model: ${modelName}`);
        document.getElementById('modelNameInput').value = '';
        refreshModels();
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

// Delete model
async function deleteModel(modelName) {
    if (!confirm(`Are you sure you want to delete model: ${modelName}?`)) {
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
        
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to delete model');
        
        showMessage('Success', `Successfully deleted model: ${modelName}`);
        refreshModels();
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

// Show model configuration
let currentModel = null;

async function showModelConfig(modelName) {
    try {
        currentModel = modelName;
        const response = await fetch(`/api/models/config?name=${encodeURIComponent(modelName)}`);
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to fetch model configuration');
        
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
