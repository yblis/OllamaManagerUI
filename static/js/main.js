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

// Rest of the file remains unchanged...
[Previous code from line 78 onwards remains the same]
