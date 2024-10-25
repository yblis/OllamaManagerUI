// Refresh intervals
const REFRESH_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;
let retryCount = 0;
let serverIsKnownOffline = false;
let lastKnownServerStatus = null;

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
        
        const currentStatus = data.status === 'running';
        if (lastKnownServerStatus !== currentStatus) {
            serverIsKnownOffline = !currentStatus;
            updateServerStatus(currentStatus);
            lastKnownServerStatus = currentStatus;
        }
        retryCount = 0;
    } catch (error) {
        // Only log error when status changes or on first attempt
        if (lastKnownServerStatus !== false) {
            console.error('Server connection error:', error.message);
            lastKnownServerStatus = false;
        }
        
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(checkServerStatus, 2000); // Retry after 2 seconds
        } else {
            if (!serverIsKnownOffline) {
                serverIsKnownOffline = true;
                updateServerStatus(false);
            }
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

    // Update batch action buttons
    const batchButtons = document.querySelectorAll('.batch-actions .ui.button');
    batchButtons.forEach(btn => {
        btn.disabled = !isRunning;
        if (!isRunning) {
            btn.classList.add('disabled');
        } else {
            btn.classList.remove('disabled');
        }
    });
}

// Refresh all data with improved error handling
async function refreshAll() {
    if (!serverIsKnownOffline) {
        await Promise.all([
            refreshModels().catch(error => {
                if (!serverIsKnownOffline) {
                    console.error('Error refreshing models:', error.message);
                }
            }),
            refreshStats().catch(error => {
                if (!serverIsKnownOffline) {
                    console.error('Error refreshing stats:', error.message);
                }
            })
        ]);
    }
}

/* Format byte sizes into human-readable format */
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

/* Fetch and display statistics */
async function refreshStats() {
    try {
        const response = await fetch('/api/models/stats');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        // Update overall stats
        const overallStats = document.getElementById('overallStats');
        overallStats.innerHTML = `
            <div class="ui statistic">
                <div class="value">${data.total_operations || 0}</div>
                <div class="label">Total Operations</div>
            </div>
            <div class="ui statistic">
                <div class="value">${data.total_prompt_tokens || 0}</div>
                <div class="label">Total Prompt Tokens</div>
            </div>
            <div class="ui statistic">
                <div class="value">${data.total_completion_tokens || 0}</div>
                <div class="label">Total Completion Tokens</div>
            </div>
            <div class="ui statistic">
                <div class="value">${(data.total_duration || 0).toFixed(2)}s</div>
                <div class="label">Total Duration</div>
            </div>
        `;
    } catch (error) {
        if (!serverIsKnownOffline) {
            console.error('Error refreshing stats:', error);
        }
    }
}

/* Display models in table format with improved error handling */
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

/* Refresh models with improved error handling */
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
        if (!serverIsKnownOffline) {
            console.error('Error refreshing models:', error.message);
        }
        const errorMsg = error.message.includes('not running') ? 
            'Ollama server is not running. Please start the server and try again.' :
            error.message;
        displayModels([], 'localModels', errorMsg);
        displayModels([], 'runningModels', errorMsg);
    }
}

/* Show model configuration modal */
async function showModelConfig(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/config`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const config = await response.json();
        
        // Populate modal fields
        document.getElementById('selectedModels').innerHTML = `
            <div class="item">
                <i class="cube icon"></i>
                ${modelName}
            </div>
        `;
        document.getElementById('systemPrompt').value = config.system || '';
        document.getElementById('template').value = config.template || '';
        
        // Populate parameters
        const parametersDiv = document.getElementById('parameters');
        parametersDiv.innerHTML = '';
        Object.entries(config.parameters || {}).forEach(([key, value]) => {
            parametersDiv.innerHTML += `
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
        
        // Show modal
        $('#configModal').modal('show');
    } catch (error) {
        showMessage('Error', `Failed to load model configuration: ${error.message}`);
    }
}

/* Show model statistics modal */
async function showModelStats(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/stats`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const stats = await response.json();
        
        // Update modal content
        document.getElementById('modelStats').innerHTML = `
            <h3>${modelName} Statistics</h3>
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
                <h4>Operations by Type</h4>
                <div class="ui list">
                    ${Object.entries(stats.operations_by_type || {})
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
        
        // Show modal
        $('#statsModal').modal('show');
    } catch (error) {
        showMessage('Error', `Failed to load model statistics: ${error.message}`);
    }
}

/* Delete model with confirmation */
async function deleteModel(modelName) {
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) {
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
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        
        showMessage('Success', result.message);
        refreshModels();
    } catch (error) {
        showMessage('Error', `Failed to delete model: ${error.message}`);
    }
}

/* Helper function to show messages */
function showMessage(title, message, isError = false) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('modalMessage').className = isError ? 'error-message' : 'success-message';
    $('#messageModal').modal('show');
}

/* Initialize modals and other UI components */
$(document).ready(function() {
    $('.ui.modal').modal();
});
