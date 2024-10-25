// Refresh intervals
const REFRESH_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;
let retryCount = 0;
let serverIsKnownOffline = false;
let lastKnownServerStatus = null;
let lastErrorTimestamp = 0;
const ERROR_DEBOUNCE_TIME = 5000; // 5 seconds

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded, initializing...');
    $('.ui.modal').modal();
    refreshAll();
    setInterval(checkServerStatus, REFRESH_INTERVAL);
    
    // Ensure pullModel is defined
    if (typeof pullModel === 'function') {
        console.log('pullModel function is properly defined');
    } else {
        console.error('pullModel function is not defined');
    }
});

// Rest of the existing code...
[Previous content of the file remains unchanged]
