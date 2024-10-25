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

// Show settings modal
function showSettings() {
    const ollamaUrl = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
    document.getElementById('ollamaUrl').value = ollamaUrl;
    $('#settingsModal').modal('show');
}

// Save settings
async function saveSettings() {
    const ollamaUrl = document.getElementById('ollamaUrl').value.trim();
    if (!ollamaUrl) {
        showMessage('Error', 'Please enter the Ollama server URL', true);
        return;
    }
    
    try {
        // Test connection to new URL
        const response = await makeApiRequest('/models');
        if (!response.models) throw new Error('Could not connect to Ollama server');
        
        localStorage.setItem('ollamaUrl', ollamaUrl);
        $('#settingsModal').modal('hide');
        showMessage('Success', 'Settings saved successfully');
        refreshAll(); // Refresh with new URL
    } catch (error) {
        showMessage('Error', `Failed to connect to Ollama server: ${error.message}`, true);
    }
}

// Get Ollama URL
function getOllamaUrl() {
    return localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
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

// Make API request with Ollama URL header
async function makeApiRequest(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;
    const headers = {
        ...options.headers,
        'X-Ollama-URL': getOllamaUrl()
    };
    
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Refresh everything
async function refreshAll() {
    try {
        const serverStatus = await checkServerStatus();
        if (!serverStatus) {
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
        const data = await makeApiRequest('/server/status');
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
        const data = await makeApiRequest('/models/batch/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names: selectedModels })
        });

        displayBatchResults(data.results);
        refreshModels();
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

// Stop model
async function stopModel(modelName) {
    if (!confirm(`Are you sure you want to stop model: ${modelName}?`)) {
        return;
    }
    
    try {
        const data = await makeApiRequest('/models/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });
        
        showMessage('Success', `Successfully stopped model: ${modelName}`);
        refreshModels();
    } catch (error) {
        showMessage('Error', error.message, true);
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

        // Define buttons based on container type
        const buttons = containerId === 'runningModels' ? `
            <div class="ui two buttons">
                <button class="ui primary button" onclick="showModelStats('${model.name}')">
                    <i class="chart bar icon"></i> Stats
                </button>
                <button class="ui negative button" onclick="stopModel('${model.name}')">
                    <i class="stop icon"></i> Stop
                </button>
            </div>
        ` : `
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
        `;
        
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
                ${buttons}
            </div>
        `;
        
        container.appendChild(card);
    });

    // Initialize checkboxes
    $('.ui.checkbox').checkbox();
}

[...rest of the file remains the same...]
