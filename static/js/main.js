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

    const progressBar = $('#pullProgress');
    progressBar.progress({
        percent: 0
    });
    progressBar.show();

    try {
        const response = await fetch('/api/models/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to pull model');
        
        // Update progress to 100% when complete
        progressBar.progress({
            percent: 100
        });
        setTimeout(() => {
            progressBar.hide();
            progressBar.progress('reset');
        }, 1000);
        
        showMessage('Success', `Successfully pulled model ${modelName}`);
        document.getElementById('modelNameInput').value = '';
        refreshModels();
    } catch (error) {
        progressBar.hide();
        progressBar.progress('reset');
        showMessage('Error', error.message, true);
    }
}

[Rest of the file remains unchanged...]
