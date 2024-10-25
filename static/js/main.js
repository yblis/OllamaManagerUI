[Previous content up to line 394...]

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
