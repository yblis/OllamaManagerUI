// Refresh intervals and configuration
const REFRESH_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
let retryCount = 0;
let serverIsKnownOffline = false;
let lastKnownServerStatus = null;
let serverCheckTimer = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize application
function initializeApp() {
    $('.ui.modal').modal();
    startServerCheck();
    refreshAll();
}

// Server status check with improved retry logic
function startServerCheck() {
    checkServerStatus();
    if (serverCheckTimer) {
        clearInterval(serverCheckTimer);
    }
    serverCheckTimer = setInterval(checkServerStatus, REFRESH_INTERVAL);
}

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
            
            if (currentStatus) {
                retryCount = 0;
                refreshAll();
            }
        }
    } catch (error) {
        handleServerError(error);
    }
}

function handleServerError(error) {
    console.error('Server connection error:', error.message);
    
    if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(checkServerStatus, RETRY_DELAY * retryCount); // Progressive delay
    } else {
        if (!serverIsKnownOffline) {
            serverIsKnownOffline = true;
            updateServerStatus(false);
            showMessage('Connection Error', 'Unable to connect to the server. Please check if Ollama is running.', true);
        }
    }
}

// Update server status UI with improved feedback
function updateServerStatus(isRunning) {
    const statusDiv = document.getElementById('serverStatus');
    const statusClass = isRunning ? 'positive' : 'negative';
    const statusIcon = isRunning ? 'check circle' : 'times circle';
    const statusText = `Ollama server is ${isRunning ? 'running' : 'not running'}`;
    
    statusDiv.className = `ui tiny message ${statusClass}`;
    statusDiv.innerHTML = `
        <i class="icon ${statusIcon}"></i>
        <span>${statusText}</span>
    `;

    // Update all interactive elements
    updateUIElements(isRunning);
}

// Update UI elements based on server status
function updateUIElements(isEnabled) {
    // Update all buttons
    document.querySelectorAll('.ui.button:not(.modal .button)').forEach(btn => {
        if (isEnabled) {
            btn.classList.remove('disabled');
            btn.disabled = false;
        } else {
            btn.classList.add('disabled');
            btn.disabled = true;
        }
    });

    // Update input fields
    document.querySelectorAll('input:not(.modal input)').forEach(input => {
        input.disabled = !isEnabled;
    });

    // Update checkboxes
    document.querySelectorAll('.ui.checkbox input').forEach(checkbox => {
        checkbox.disabled = !isEnabled;
    });

    // Show/hide error messages
    const errorMessages = document.querySelectorAll('.ui.warning.message');
    errorMessages.forEach(msg => {
        msg.style.display = isEnabled ? 'none' : 'block';
    });
}

// Refresh all data with improved error handling
async function refreshAll() {
    if (!serverIsKnownOffline) {
        try {
            await Promise.all([
                refreshModels(),
                refreshStats()
            ]);
        } catch (error) {
            console.error('Error refreshing data:', error);
            if (error.message.includes('503')) {
                serverIsKnownOffline = true;
                updateServerStatus(false);
            }
        }
    }
}

[... Rest of the file remains unchanged ...]
