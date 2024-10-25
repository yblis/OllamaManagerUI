// Refresh intervals
const REFRESH_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;
let retryCount = 0;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    refreshAll();
    setInterval(checkServerStatus, REFRESH_INTERVAL);
});

// Server status check with retry logic
async function checkServerStatus() {
    try {
        const response = await fetch('/api/server/status');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        updateServerStatus(data.status === 'running');
        // Reset retry count on successful connection
        retryCount = 0;
    } catch (error) {
        console.error('Error checking server status:', error);
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(checkServerStatus, 2000); // Retry after 2 seconds
        } else {
            updateServerStatus(false);
        }
    }
}

// Update server status UI
function updateServerStatus(isRunning) {
    const statusDiv = document.getElementById('serverStatus');
    statusDiv.className = `ui message ${isRunning ? 'positive' : 'negative'}`;
    statusDiv.innerHTML = `
        <i class="icon ${isRunning ? 'check circle' : 'times circle'}"></i>
        <span>Ollama server is ${isRunning ? 'running' : 'not running'}</span>
        ${!isRunning && retryCount >= MAX_RETRIES ? 
            '<div class="ui warning message">Unable to connect after several attempts. Please check if Ollama is running.</div>' : ''}
    `;

    // Update UI elements based on server status
    const actionButtons = document.querySelectorAll('.model-action-btn');
    actionButtons.forEach(btn => {
        btn.disabled = !isRunning;
        if (!isRunning) {
            btn.classList.add('disabled');
        } else {
            btn.classList.remove('disabled');
        }
    });
}

// Refresh all data with error handling
async function refreshAll() {
    await Promise.all([
        refreshModels().catch(error => console.error('Error refreshing models:', error)),
        refreshStats().catch(error => console.error('Error refreshing stats:', error))
    ]);
}

// Display models in table format with improved error handling
function displayModels(models, containerId, errorMessage = null) {
    const container = document.getElementById(containerId);
    const tbody = container.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (errorMessage) {
        const errorMsg = errorMessage.includes('503') ? 
            'Ollama server is not running. Please start the server and try again.' : 
            errorMessage;
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="ui warning message">
                        <div class="header">Error</div>
                        <p>${errorMsg}</p>
                        ${errorMessage.includes('503') ? 
                            '<p>Make sure Ollama is installed and running on your system.</p>' : ''}
                    </div>
                </td>
            </tr>`;
        return;
    }
    
    if (!models || models.length === 0) {
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
                    <button class="ui primary button model-action-btn" onclick="showModelStats('${model.name}')">
                        <i class="chart bar icon"></i> Stats
                    </button>
                    <button class="ui teal button model-action-btn" onclick="showModelConfig('${model.name}')">
                        <i class="cog icon"></i> Config
                    </button>
                    ${containerId === 'localModels' ? `
                        <button class="ui negative button model-action-btn" onclick="deleteModel('${model.name}')">
                            <i class="trash icon"></i> Delete
                        </button>
                    ` : `
                        <button class="ui negative button model-action-btn" onclick="stopModel('${model.name}')">
                            <i class="stop icon"></i> Stop
                        </button>
                    `}
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    }

    // Initialize checkboxes
    $('.ui.checkbox').checkbox();
}

// Refresh models with improved error handling
async function refreshModels() {
    try {
        // Check server status first
        const statusResponse = await fetch('/api/server/status');
        const statusData = await statusResponse.json();
        
        if (statusData.status !== 'running') {
            throw new Error('Ollama server is not running');
        }

        // Get local models
        const localResponse = await fetch('/api/models');
        if (!localResponse.ok) {
            throw new Error(`HTTP error! status: ${localResponse.status}`);
        }
        const localData = await localResponse.json();
        displayModels(localData.models || [], 'localModels');
        
        // Get running models
        const runningResponse = await fetch('/api/models/running');
        if (!runningResponse.ok) {
            throw new Error(`HTTP error! status: ${runningResponse.status}`);
        }
        const runningData = await runningResponse.json();
        displayModels(runningData.models || [], 'runningModels');
    } catch (error) {
        console.error('Error refreshing models:', error.message);
        const errorMsg = error.message.includes('not running') ? 
            'Ollama server is not running. Please start the server and try again.' :
            error.message;
        displayModels([], 'localModels', errorMsg);
        displayModels([], 'runningModels', errorMsg);
    }
}

// Rest of the code remains the same...
// (Previous utility functions and modal initialization)
