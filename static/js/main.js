// Refresh intervals
const REFRESH_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;
let retryCount = 0;
let serverIsKnownOffline = false;
let lastKnownServerStatus = null;
let lastErrorTimestamp = 0;
const ERROR_DEBOUNCE_TIME = 5000; // 5 seconds
let headers = {}; // Global headers object

// Initialize UI elements
document.addEventListener('DOMContentLoaded', function() {
    // Initialize headers from localStorage if available
    const savedUrl = localStorage.getItem('ollamaUrl');
    if (savedUrl) {
        headers = { 'X-Ollama-URL': savedUrl };
    }
    
    refreshAll();
    $('.ui.checkbox').checkbox();
    $('.ui.dropdown').dropdown();
    $('.ui.modal').modal();
    
    // Fix the event listener syntax
    const modelInput = document.getElementById('modelNameInput');
    if (modelInput) {
        modelInput.addEventListener('input', debounce(searchAndPullModel, 500));
    }
    
    // Set up periodic refresh for running models
    setInterval(refreshRunningModels, REFRESH_INTERVAL);
});

// Server status check and refresh functions
async function refreshAll() {
    if (!serverIsKnownOffline) {
        try {
            await Promise.all([
                refreshLocalModels(),
                refreshRunningModels(),
                refreshStats()
            ]);
        } catch (error) {
            handleServerError(error, 'Actualisation');
        }
    }
}

async function checkServerStatus() {
    try {
        const response = await fetch('/api/server/status', { headers });
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const data = await response.json();
        
        const currentStatus = data.status === 'running';
        if (lastKnownServerStatus !== currentStatus) {
            serverIsKnownOffline = !currentStatus;
            updateServerStatus(currentStatus);
            lastKnownServerStatus = currentStatus;
            
            if (currentStatus) {
                retryCount = 0;
                refreshAll();
            }
        }
    } catch (error) {
        handleServerError(error);
    }
}

// Settings modal functions
function showSettings() {
    const url = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
    document.getElementById('ollamaUrl').value = url;
    $('#settingsModal').modal('show');
}

async function saveSettings() {
    const ollamaUrl = document.getElementById('ollamaUrl').value;
    if (ollamaUrl) {
        localStorage.setItem('ollamaUrl', ollamaUrl);
        // Use headers in the global scope to ensure it's properly set
        headers = { 'X-Ollama-URL': ollamaUrl };
        // Add headers to all future requests
        await refreshAll();
    }
    $('#settingsModal').modal('hide');
}

// Model operations
async function refreshLocalModels() {
    try {
        const response = await fetch('/api/models', { headers });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        displayModels(data.models || [], 'localModels');
    } catch (error) {
        console.error('Error:', error);
        displayModels([], 'localModels', error.message);
    }
}

async function refreshRunningModels() {
    if (serverIsKnownOffline) {
        displayModels([], 'runningModels', 'Le serveur est hors ligne');
        return;
    }
    
    try {
        const button = document.querySelector('button[onclick="refreshRunningModels()"]');
        if (button) {
            button.classList.add('loading');
        }
        
        const response = await fetch('/api/models/running', { headers });
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const data = await response.json();
        displayModels(data.models || [], 'runningModels');
    } catch (error) {
        console.error('Error:', error);
        displayModels([], 'runningModels', error.message);
    } finally {
        const button = document.querySelector('button[onclick="refreshRunningModels()"]');
        if (button) {
            button.classList.remove('loading');
        }
    }
}

[Rest of the file remains unchanged...]
