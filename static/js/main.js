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
    $('.ui.modal').modal('show');
}

// Format file size
function formatSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

// Refresh everything
async function refreshAll() {
    await checkServerStatus();
    await refreshModels();
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
        } else {
            statusDiv.className = 'ui message negative';
            icon.className = 'icon times circle';
            text.textContent = 'Ollama server is not running';
        }
    } catch (error) {
        console.error('Error checking server status:', error);
    }
}

// Refresh models
async function refreshModels() {
    try {
        // Get local models
        const localResponse = await fetch('/api/models');
        const localData = await localResponse.json();
        
        if (!localResponse.ok) {
            if (localResponse.status === 503) {
                displayModels([], 'localModels', 'Server not running');
                displayModels([], 'runningModels', 'Server not running');
                return;
            }
            throw new Error(localData.error || 'Failed to fetch local models');
        }
        
        // Get running models
        const runningResponse = await fetch('/api/models/running');
        const runningData = await runningResponse.json();
        
        if (!runningResponse.ok) throw new Error(runningData.error || 'Failed to fetch running models');
        
        displayModels(localData.models || [], 'localModels');
        displayModels(runningData.models || [], 'runningModels');
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
        
        card.innerHTML = `
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
                <button class="ui negative button" onclick="deleteModel('${model.name}')">
                    <i class="trash icon"></i> Delete
                </button>
            </div>
        `;
        
        container.appendChild(card);
    });
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
