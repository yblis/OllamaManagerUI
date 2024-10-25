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
        .catch(error => {
            console.error('Error checking server status:', error);
            const statusDiv = document.getElementById('serverStatus');
            statusDiv.className = 'ui negative message';
            statusDiv.innerHTML = `
                <i class="times circle icon"></i>
                <span>Error checking server status</span>
            `;
        });
}

// Refresh all data
function refreshAll() {
    refreshModels();
    refreshStats();
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
                    <button class="ui primary button" onclick="showModelStats('${model.name}')">
                        <i class="chart bar icon"></i> Stats
                    </button>
                    <button class="ui teal button" onclick="showModelConfig('${model.name}')">
                        <i class="cog icon"></i> Config
                    </button>
                    ${containerId === 'localModels' ? `
                        <button class="ui negative button" onclick="deleteModel('${model.name}')">
                            <i class="trash icon"></i> Delete
                        </button>
                    ` : `
                        <button class="ui negative button" onclick="stopModel('${model.name}')">
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

// Refresh models
async function refreshModels() {
    try {
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
        displayModels([], 'localModels', error.message);
        displayModels([], 'runningModels', error.message);
    }
}

// Refresh statistics
async function refreshStats() {
    try {
        const response = await fetch('/api/models/stats');
        if (!response.ok) throw new Error('Failed to fetch statistics');
        
        const data = await response.json();
        
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

// Compare selected models
async function compareSelectedModels() {
    const selectedModels = getSelectedModels();
    if (selectedModels.length < 2) {
        showMessage('Error', 'Please select at least two models to compare', true);
        return;
    }

    try {
        const response = await fetch('/api/models/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ models: selectedModels })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to compare models');
        }
        
        const data = await response.json();
        displayModelComparison(data.comparison);
    } catch (error) {
        showMessage('Error', error.message, true);
    }
}

// Display model comparison
function displayModelComparison(comparisonData) {
    const comparisonDiv = document.getElementById('modelComparison');
    const columnWidth = Math.floor(16 / comparisonData.length);  // Semantic UI uses a 16-column grid

    let html = '';
    comparisonData.forEach(model => {
        html += `
            <div class="column" style="width: ${columnWidth * 100 / 16}%">
                <div class="ui segment">
                    <h3 class="ui header">${model.name}</h3>
                    
                    <h4 class="ui header">Basic Information</h4>
                    <div class="ui list">
                        <div class="item">
                            <div class="header">Size</div>
                            <div class="description">${formatSize(model.size)}</div>
                        </div>
                        <div class="item">
                            <div class="header">Format</div>
                            <div class="description">${model.details.format || 'N/A'}</div>
                        </div>
                        <div class="item">
                            <div class="header">Family</div>
                            <div class="description">${model.details.family || 'N/A'}</div>
                        </div>
                        <div class="item">
                            <div class="header">Parameters</div>
                            <div class="description">${model.details.parameter_size || 'N/A'}</div>
                        </div>
                    </div>

                    <h4 class="ui header">Configuration</h4>
                    <div class="ui list">
                        <div class="item">
                            <div class="header">System Prompt</div>
                            <div class="description">${model.config.system || 'None'}</div>
                        </div>
                        <div class="item">
                            <div class="header">Template</div>
                            <div class="description">${model.config.template || 'None'}</div>
                        </div>
                        <div class="item">
                            <div class="header">Parameters</div>
                            <div class="description">
                                ${Object.entries(model.config.parameters || {}).map(([key, value]) => 
                                    `<div>${key}: ${value}</div>`
                                ).join('') || 'None'}
                            </div>
                        </div>
                    </div>

                    <h4 class="ui header">Usage Statistics</h4>
                    <div class="ui tiny statistics">
                        <div class="statistic">
                            <div class="value">${model.stats.total_operations}</div>
                            <div class="label">Operations</div>
                        </div>
                        <div class="statistic">
                            <div class="value">${model.stats.total_prompt_tokens}</div>
                            <div class="label">Prompt Tokens</div>
                        </div>
                        <div class="statistic">
                            <div class="value">${model.stats.total_completion_tokens}</div>
                            <div class="label">Completion Tokens</div>
                        </div>
                        <div class="statistic">
                            <div class="value">${formatDuration(model.stats.total_duration)}</div>
                            <div class="label">Duration</div>
                        </div>
                    </div>

                    <h5 class="ui header">Operations by Type</h5>
                    <div class="ui list">
                        ${Object.entries(model.stats.operations_by_type || {}).map(([type, count]) => `
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
            </div>
        `;
    });

    comparisonDiv.innerHTML = html;
    $('#comparisonModal').modal('show');
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

function getSelectedModels() {
    const checkboxes = document.querySelectorAll('#localModels input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.model);
}

// Initialize modals
$('.ui.modal').modal();
