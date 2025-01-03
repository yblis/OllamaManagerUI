// Server status check
let ollamaUrl = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';

// Add this after the variable declaration
if (window.location.hostname !== 'localhost') {
    // If we're not on localhost, try to get the URL from environment
    fetch('/api/server/url')
        .then(response => response.json())
        .then(data => {
            if (data.url) {
                ollamaUrl = data.url;
                localStorage.setItem('ollamaUrl', ollamaUrl);
            }
        })
        .catch(console.error);
}

async function checkServerStatus() {
    try {
        const statusDot = document.getElementById('statusDot');
        if (!statusDot) return;

        const response = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });

        if (!response.ok) {
            statusDot.className = 'status-indicator offline';
            return;
        }

        const data = await response.json();
        statusDot.className = 'status-indicator ' + (data.status === 'running' ? 'online' : 'offline');

        // Update status check interval
        setTimeout(checkServerStatus, 5000);
    } catch (error) {
        const statusDot = document.getElementById('statusDot');
        if (statusDot) {
            statusDot.className = 'status-indicator offline';
        }
        setTimeout(checkServerStatus, 5000);
    }
}

// Start status checking when page loads
document.addEventListener('DOMContentLoaded', checkServerStatus);

// Settings management
window.showSettings = function() {
    // Get the stored URL from localStorage
    const storedUrl = localStorage.getItem('ollamaUrl');
    if (storedUrl) {
        document.getElementById('ollamaUrl').value = storedUrl;
    } else {
        document.getElementById('ollamaUrl').value = ollamaUrl;
    }

    // Set current language in dropdown
    const currentLang = document.cookie.split(';').find(row => row.trim().startsWith('language='));
    if (currentLang) {
        document.getElementById('languageSelect').value = currentLang.split('=')[1];
    }
    $('#settingsModal').modal('show');
};

window.saveSettings = function() {
    const newUrl = document.getElementById('ollamaUrl').value.trim();
    if (newUrl) {
        ollamaUrl = newUrl;
        localStorage.setItem('ollamaUrl', ollamaUrl);
        $('#settingsModal').modal('hide');
        checkServerStatus();
        refreshAll();
    }
};

// Update language change function
window.changeLanguage = async function(lang) {
    try {
        console.log(`Attempting to change language to: ${lang}`);
        const response = await fetch('/api/language', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ language: lang }),
            credentials: 'same-origin'  // Important: Include credentials for cookies
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || gettext('Failed to change language'));
        }

        if (data.success) {
            console.log('Language change successful, reloading page...');
            // Force a hard reload to ensure new language is applied
            window.location.href = window.location.href;
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Language change error:', error);
        showMessage('Error', error.message, true);
    }
};

// Message display
window.showMessage = function(title, message, isError = false) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('messageModal').className = `ui modal ${isError ? 'negative' : 'positive'}`;
    $('#messageModal').modal('show');
};

// Model management functions
window.stopModel = async function(modelName) {
    if (!confirm(gettext('Are you sure you want to stop the model')+` ${modelName} ?`)) {
        return;
    }

    try {
        const response = await fetch('/api/models/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Ollama-URL': ollamaUrl
            },
            body: JSON.stringify({ name: modelName })
        });

        if (!response.ok) {
            const data = await response.json();
            let failureText = gettext('Failed to stop the model');
            throw new Error(data.error || failureText);
        }

        showMessage(gettext('Success'), gettext('Model')+` ${modelName} `+gettext('stopped successfully'));
        await refreshRunningModels();  // Refresh only running models table
    } catch (error) {
        showMessage(gettext('Error'), error.message, true);
    }
};

window.showModelConfig = async function(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/config`, {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) throw new Error( gettext('HTTP Error Status')+`: ${response.status}`);
        const config = await response.json();

        document.getElementById('selectedModels').innerHTML = `
            <div class="item">
                <i class="cube icon"></i>
                ${modelName}
            </div>
        `;

        document.getElementById('systemPrompt').value = config.system || '';
        document.getElementById('template').value = config.template || '';

        const parametersContainer = document.getElementById('parameters');
        parametersContainer.innerHTML = '';

        Object.entries(config.parameters || {}).forEach(([key, value]) => {
            parametersContainer.innerHTML += `
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

        $('#configModal').modal('show');
    } catch (error) {
        showMessage(gettext('Error'), error.message, true);
    }
};

window.showModelStats = async function(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/stats`, {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) throw new Error( gettext('HTTP Error Status')+`: ${response.status}`);
        const stats = await response.json();

        let operationsText = gettext('Operation(s)');
        document.getElementById('modelStats').innerHTML = `
            <div class="ui statistics">
                <div class="statistic">
                    <div class="value">${stats.total_operations || 0}</div>
                    <div class="label">`+gettext('Total Operations')+`</div>
                </div>
                <div class="statistic">
                    <div class="value">${stats.total_prompt_tokens || 0}</div>
                    <div class="label">`+gettext('Total Prompt Tokens')+`</div>
                </div>
                <div class="statistic">
                    <div class="value">${stats.total_completion_tokens || 0}</div>
                    <div class="label">`+gettext('Total Complete Tokens')+`</div>
                </div>
                <div class="statistic">
                    <div class="value">${(stats.total_duration || 0).toFixed(2)}s</div>
                    <div class="label">`+gettext('Total Duration')+`</div>
                </div>
            </div>

            <div class="ui segment">
                <h4 class="ui header">`+gettext('Operations by Type')+`</h4>
                <div class="ui list">
                    ${Object.entries(stats.operations_by_type || {}).map(([type, count]) => `
                        <div class="item">
                            <i class="right triangle icon"></i>
                            <div class="content">
                                <div class="header">${type}</div>
                                <div class="description">${count} `+operationsText+`</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        $('#statsModal').modal('show');
    } catch (error) {
        showMessage(gettext('Error'), error.message, true);
    }
};

window.deleteModel = async function(modelName) {
    let deleteConfirmText = gettext('Are you sure you want to delete this model?');
    if (!confirm(deleteConfirmText
        + `\n${modelName}`)) {
        return;
    }

    try {
        const response = await fetch('/api/models/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Ollama-URL': ollamaUrl
            },
            body: JSON.stringify({ name: modelName })
        });

        if (!response.ok) {
            const data = await response.json();
            let failureText = gettext('Failed to delete the model');
            throw new Error(data.error || failureText);
        }

        showMessage(gettext('Success'), gettext('Model')+` ${modelName} `+gettext('successfully deleted'));
        refreshAll();
    } catch (error) {
        showMessage(gettext('Error'), error.message, true);
    }
};

// Theme management
function setTheme(themeName) {
    localStorage.setItem('theme', themeName);
    document.documentElement.setAttribute('data-theme', themeName);
    const icon = document.querySelector('#settingsModal .ui.circular.button i');
    if (icon) {
        icon.className = themeName === 'dark' ? 'moon icon' : 'sun icon';
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// Function to debounce events
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        const later = () => {
            clearTimeout(timeout);
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to update search results position
function updateSearchResultsPosition() {
    const searchInput = document.getElementById('modelNameInput');
    const searchContainer = document.getElementById('searchContainer');
    const resultsContainer = document.getElementById('searchResultsContainer');

    if (searchInput && searchContainer && resultsContainer) {
        const rect = searchContainer.getBoundingClientRect();
        resultsContainer.style.top = `${rect.bottom + window.scrollY}px`;
        resultsContainer.style.left = `${rect.left}px`;
        resultsContainer.style.width = `${rect.width}px`;
    }
}

// Model search and pull
let searchTimeout = null;

// Toggle model source
window.toggleModelSource = function(button) {
    // Remove active class from all buttons
    document.querySelectorAll('.toggle-container .button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Add active class to clicked button
    button.classList.add('active');

    const source = button.getAttribute('data-source');

    // Show/hide Ollama filters
    const ollamaFilters = document.getElementById('ollamaFilters');
    ollamaFilters.style.display = source === 'ollama' ? 'block' : 'none';

    // Clear and hide results when switching sources
    const searchResults = document.querySelector('.search-results');
    const searchResultsList = document.getElementById('searchResults');

    if ( searchResults!==undefined && searchResults!==null ) {
        searchResults.style.display = 'none';
        searchResultsList.innerHTML = '';
    }

    document.getElementById('modelNameInput').value = '';
};

// Function to search models with proper syntax
window.searchModels = function(input) {
    clearTimeout(searchTimeout);
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const searchResultsList = document.getElementById('searchResults');
    const selectedSource = document.querySelector('.toggle-container .button.active').getAttribute('data-source');
    const selectedFilters = Array.from(document.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value);

    if (!input.value.trim()) {
        searchResultsContainer.style.display = 'none';
        return;
    }

    // Update position before showing results
    updateSearchResultsPosition();

    searchTimeout = setTimeout(async () => {
        try {
            const query = input.value.trim();
            const response = await fetch('/api/models/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Ollama-URL': ollamaUrl
                },
                body: JSON.stringify({
                    keyword: query,
                    source: selectedSource,
                    filters: selectedFilters
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to search models');
            }

            const data = await response.json();

            if (!data.models || !data.models.length) {
                searchResultsList.innerHTML = '<div class="item">'+gettext('No models found')+'</div>';
                searchResultsContainer.style.display = 'block';
                return;
            }

            const resultItems = data.models.map(model => {
                const modelName = typeof model === 'string' ? model : model.name;
                const tags = typeof model === 'string' ? [] : model.tags || [];

                return `
                    <div class="item" style="cursor: pointer; padding: 0.5em;" onclick="selectModel('${modelName}')">
                        <i class="cube icon"></i>
                        <div class="content">
                            <div class="header">${modelName}</div>
                            ${tags.length ? `<div class="description">${tags.join(', ')}</div>` : ''}
                        </div>
                    </div>`;
            }).join('');

            searchResultsList.innerHTML = resultItems;
            searchResultsContainer.style.display = 'block';
        } catch (error) {
            showMessage(gettext('Error'), error.message, true);
        }
    }, 300);
};

window.selectModel = function(modelId) {
    const modelInput = document.getElementById('modelNameInput');
    modelInput.value = modelId;
    document.getElementById('searchResultsContainer').style.display = 'none';
};

window.pullModel = async function() {
    const modelName = document.getElementById('modelNameInput').value.trim();
    if (!modelName) {
        showMessage(gettext('Error'), gettext('Please enter a model name'), true);
        return;
    }

    const progress = document.getElementById('pullProgress');
    progress.style.display = 'block';

    // Initialize progress bar with Semantic UI
    $(progress).progress({
        percent: 0,
        text: {
            active: gettext('Starting the download...'),
            success: gettext('Download complete'),
            error: gettext('Error downloading')
        }
    });

    try {
        const response = await fetch('/api/models/pull', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Ollama-URL': ollamaUrl
            },
            body: JSON.stringify({ name: modelName })
        });

        if (!response.ok) {
            const data = await response.json();
            let failureText = gettext('Failed to download the model');
            throw new Error(data.error || failureText);
        }

        const contentLength = response.headers.get('Content-Length');
        const total = parseInt(contentLength, 10);
        let loaded = 0;

        // Créer un nouveau ReadableStream
        const stream = new ReadableStream({
            start(controller) {
                const reader = response.body.getReader();

                async function push() {
                    try {
                        while (true) {
                            const {done, value} = await reader.read();

                            if (done) {
                                controller.close();
                                break;
                            }

                            loaded += value.length;
                            const percent = (loaded / total) * 100;

                            // Update progress bar
                            $(progress).progress('set percent', Math.round(percent));
                            $(progress).progress('set label', gettext('Download progress')+`: ${Math.round(percent)}%`);

                            controller.enqueue(value);
                        }
                    } catch (error) {
                        controller.error(error);
                    }
                }

                push();
            }
        });

        // Attendre que le stream soit complètement lu
        await new Response(stream).blob();

        // Téléchargement terminé avec succès
        $(progress).progress('set percent', 100);
        $(progress).progress('set label', gettext('Download complete'));

        showMessage(gettext('Success'), gettext('Model')+` ${modelName} `+gettext('downloaded successfully'));
        document.getElementById('modelNameInput').value = '';
        refreshAll();
    } catch (error) {
        $(progress).progress('set percent', 0);
        $(progress).progress('set label', gettext('Error downloading'));
        showMessage(gettext('Error'), error.message, true);
    } finally {
        setTimeout(() => {
            progress.style.display = 'none';
        }, 2000);
    }
};

// Refresh functions
function formatDate(dateStr) {
    if (!dateStr) return 'Date inconnue';

    try {
        // Parse the ISO date string with timezone
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Date inconnue';

        // Format date as DD/MM/YYYY
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    } catch (error) {
        console.error('Error formatting date:', dateStr, error);
        return 'Date inconnue';
    }
}

async function refreshLocalModels() {
    try {
        const serverStatusResponse = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        const serverStatus = await serverStatusResponse.json();

        if (serverStatus.status !== 'running') {
            const tbody = document.querySelector('#localModels tbody');
            tbody.innerHTML = '<tr><td colspan="8" class="center aligned">'+gettext('Ollama server not connected')+'</td></tr>';
            return;
        }

        const response = await fetch('/api/models', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) {
            const tbody = document.querySelector('#localModels tbody');
            tbody.innerHTML = '<tr><td colspan="8" class="center aligned">'+gettext('Unable to retrieve models')+'</td></tr>';
            return;
        }

        const data = await response.json();
        const tbody = document.querySelector('#localModels tbody');

        console.log('Received models data:', data.models); // Debug log

        tbody.innerHTML = data.models.map(model => {
            console.log('Processing model:', model.name, 'modified_at:', model.modified_at); // Debug log
            const formattedDate = formatDate(model.modified_at);

            return `
            <tr>
                <td class="collapsing">
                    <div class="ui fitted checkbox">
                        <input type="checkbox" data-model-name="${model.name}" onchange="toggleModelSelection(this, '${model.name}')">
                        <label></label>
                    </div>
                </td>
                <td>${model.name}</td>
                <td>${formattedDate}</td>
                <td>${formatBytes(model.size)}</td>
                <td>${model.details?.format || 'N/A'}</td>
                <td>${model.details?.family || 'N/A'}</td>
                <td>${model.details?.parameter_size || 'N/A'}</td>
                <td class="center aligned">
                    <div class="ui tiny buttons">
                        <button class="ui button" onclick="showModelConfig('${model.name}')">
                            <i class="cog icon"></i> `+gettext('Config')+`
                        </button>
                        <button class="ui teal button" onclick="showModelStats('${model.name}')">
                            <i class="chart bar icon"></i> `+gettext('Stats')+`
                        </button>
                        <button class="ui negative button" onclick="deleteModel('${model.name}')">
                            <i class="trash icon"></i> `+gettext('Delete')+`
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('') || '<tr><td colspan="8" class="center aligned">'+gettext('No Models Installed')+'</td></tr>';
    } catch (error) {
        console.error('Error refreshing local models:', error);
        showMessage(gettext('Error'), error.message, true);
    }
}

async function refreshRunningModels() {
    try {
        const serverStatusResponse = await fetch('/api/server/status', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        const serverStatus = await serverStatusResponse.json();

        if (serverStatus.status !== 'running') {
            const tbody = document.querySelector('#runningModels tbody');
            tbody.innerHTML = '<tr><td colspan="7" class="center aligned">'+gettext('Ollama server not connected')+'</td></tr>';
            return;
        }

        const response = await fetch('/api/models/running', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) {
            const tbody = document.querySelector('#runningModels tbody');
            tbody.innerHTML = '<tr><td colspan="7" class="center aligned">'+gettext('Unable to retrieve running models')+'</td></tr>';
            return;
        }

        const data = await response.json();
        const tbody = document.querySelector('#runningModels tbody');

        console.log('Received running models data:', data.models); // Debug log

        tbody.innerHTML = data.models.map(model => {
            console.log('Processing running model:', model.name, 'modified_at:', model.modified_at); // Debug log
            const formattedDate = formatDate(model.modified_at);

            return `
            <tr>
                <td>${model.name}</td>
                <td>${formattedDate}</td>
                <td>${formatBytes(model.size)}</td>
                <td>${model.details?.format || 'N/A'}</td>
                <td>${model.details?.family || 'N/A'}</td>
                <td>${model.details?.parameter_size || 'N/A'}</td>
                <td class="center aligned">
                    <button class="ui red tiny button" onclick="stopModel('${model.name}')">
                        <i class="stop icon"></i> Arrêter
                    </button>
                </td>
            </tr>
            `;
        }).join('') || '<tr><td colspan="7" class="center aligned">'+gettext('No Models Running')+'</td></tr>';
    } catch (error) {
        console.error('Error refreshing running models:', error);
        showMessage(gettext('Error'), error.message, true);
    }
}

async function refreshStats() {
    try {
        const statsElement = document.getElementById('overallStats');
        if (!statsElement) {
            console.debug('Stats element not found, skipping refresh');
            return;
        }

        const response = await fetch('/api/models/stats', {
            headers: { 'X-Ollama-URL': ollamaUrl }
        });
        if (!response.ok) throw new Error(gettext('Failed to fetch stats'));

        const stats = await response.json();
        statsElement.innerHTML = `
            <div class="statistic">
                <div class="value">${stats.total_operations || 0}</div>
                <div class="label">`+gettext('Total Operations')+`</div>
            </div>
            <div class="statistic">
                <div class="value">${stats.total_prompt_tokens || 0}</div>
                <div class="label">`+gettext('Total Prompt Tokens')+`</div>
            </div>
            <div class="statistic">
                <div class="value">${stats.total_completion_tokens || 0}</div>
                <div class="label">`+gettext('Total Completion Tokens')+`</div>
            </div>
            <div class="statistic">
                <div class="value">${(stats.total_duration || 0).toFixed(2)}s</div>
                <div class="label">`+gettext('Total Duration')+`</div>
            </div>
        `;
    } catch (error) {
        console.error('Error refreshing stats:', error);
    }
}

// Show settings modal
window.showSettings = function() {
    $('#settingsModal').modal('show');
};

// Toggle theme function
window.toggleTheme = function() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update theme button icon
    const themeIcon = document.querySelector('.theme-toggle i');
    if (themeIcon) {
        themeIcon.className = newTheme === 'dark' ? 'moon icon' : 'sun icon';
    }
};

// Toggle all model checkboxes
window.selectAllModels = function() {
    const checkboxes = document.querySelectorAll('#localModels tbody input[type="checkbox"]');
    const masterCheckbox = document.querySelector('#localModels thead input[type="checkbox"]');
    // const isChecked = masterCheckbox.checked;

    masterCheckbox.checked = true; // !isChecked;
    checkboxes.forEach(checkbox => {
        checkbox.checked = true; // !isChecked;
    });
};

// Compare selected models
window.compareSelectedModels = function() {
    const selectedCheckboxes = document.querySelectorAll('#localModels tbody input[type="checkbox"]:checked');
    const selectedModels = Array.from(selectedCheckboxes).map(checkbox => checkbox.dataset.modelName);

    if (selectedModels.length < 2) {
        let errorMessage = gettext('Please select at least two models to compare')
        showMessage(gettext('Error'), errorMessage, true);
        return;
    }

    // Populate comparison modal
    const comparisonContainer = document.getElementById('modelComparison');
    comparisonContainer.innerHTML = selectedModels.map(model => `
        <div class="eight wide column">
            <div class="ui segment">
                <h3 class="ui header">${model}</h3>
                <div class="ui list model-details" id="details-${model}">
                    <div class="item">`+gettext('Loading details...')+`</div>
                </div>
            </div>
        </div>
    `).join('');

    // Show the modal
    $('#comparisonModal').modal('show');

    // Fetch and display details for each model
    selectedModels.forEach(async (model) => {
        try {
            const response = await fetch(`/api/models/${model}/details`, {
                headers: { 'X-Ollama-URL': ollamaUrl }
            });
            const details = await response.json();

            document.getElementById(`details-${model}`).innerHTML = `
                <div class="item">
                    <div class="header">Format</div>
                    <div class="description">${details.format || 'N/A'}</div>
                </div>
                <div class="item">
                    <div class="header">Famille</div>
                    <div class="description">${details.family || 'N/A'}</div>
                </div>
                <div class="item">
                    <div class="header">Taille des paramètres</div>
                    <div class="description">${details.parameter_size || 'N/A'}</div>
                </div>
            `;
        } catch (error) {
            document.getElementById(`details-${model}`).innerHTML = `
                <div class="item error-message">
                    `+gettext('Error loading details')+`: ${error.message}
                </div>
            `;
        }
    });
};

// Format bytes to human readable size
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Refresh all data
function refreshAll() {
    refreshLocalModels();
    refreshRunningModels();
    refreshStats();
    checkServerStatus();
}

// Set up model name input events
const modelNameInput = document.getElementById('modelNameInput');
if (modelNameInput) {
    modelNameInput.addEventListener('input', (e) => searchModels(e.target));
    modelNameInput.addEventListener('blur', () => {
        // Delay hiding results to allow for clicks
        setTimeout(() => {
            const searchResultsContainer = document.getElementById('searchResultsContainer');
            if (searchResultsContainer) {
                searchResultsContainer.style.display = 'none';
            }
        }, 200);
    });
}

// Handle source change to show/hide Ollama filters
const modelSource = document.getElementById('modelSource');
const ollamaFilters = document.getElementById('ollamaFilters');

if (modelSource && ollamaFilters) {
    modelSource.addEventListener('change', function() {
        ollamaFilters.style.display = this.value === 'ollama' ? 'block' : 'none';
        // Clear and hide results when switching sources
        const searchResultsContainer = document.getElementById('searchResultsContainer');
        const searchResultsList = document.getElementById('searchResults');
        if (searchResultsContainer) {
            searchResultsContainer.style.display = 'none';
        }
        const modelNameInput = document.getElementById('modelNameInput');
        if (modelNameInput) {
            modelNameInput.value = '';
        }
        if (searchResultsList) {
            searchResultsList.innerHTML = '';
        }
    });

    // Initial state
    ollamaFilters.style.display = modelSource.value === 'ollama' ? 'block' : 'none';
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    checkServerStatus();
    refreshAll();
    // Check status and refresh data every 30 seconds
    setInterval(refreshAll, 30000);


});

// Batch operations
let selectedModels = new Set();

window.selectAllModels = function(checkbox) {
    const checkboxes = document.querySelectorAll('#localModels tbody input[type="checkbox"]');
    const isChecked = checkbox.checked;

    selectedModels.clear(); // Réinitialiser la sélection

    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const modelName = cb.getAttribute('data-model-name');
        if (isChecked) {
            selectedModels.add(modelName);
        } else {
            selectedModels.delete(modelName);
            // Uncheck the “Select All” box if a template is unchecked
            // Décocher la case "Tous Sélectionner" si un modèle est décoché
            document.querySelector('#selectAllCheckbox').checked = false;
        }
    });

    updateCompareButton();
};

window.toggleModelSelection = function(checkbox, modelName) {
    if (checkbox.checked) {
        selectedModels.add(modelName);
    } else {
        selectedModels.delete(modelName);
        // Décocher la case "Tous Sélectionner" si un modèle est décoché
        document.querySelector('#selectAllCheckbox').checked = false;
    }
    updateCompareButton();
};

function updateCompareButton() {
    const compareButton = document.querySelector('#compareButton');
    if (compareButton) {
        compareButton.disabled = selectedModels.size < 2;
    }
}

window.compareSelectedModels = async function() {
    if (selectedModels.size < 2) {
        let errorMessage = gettext('Please select at least two models to compare')
        showMessage(gettext('Error'), errorMessage, true);
        return;
    }

    try {
        const modelsArray = Array.from(selectedModels);
        const comparisons = [];

        for (let i = 0; i < modelsArray.length; i++) {
            const modelStats = await fetch(`/api/models/${modelsArray[i]}/stats`, {
                headers: { 'X-Ollama-URL': ollamaUrl }
            }).then(res => res.json());

            comparisons.push({
                name: modelsArray[i],
                stats: modelStats
            });
        }

        const comparisonContent = document.getElementById('modelComparison');
        comparisonContent.innerHTML = comparisons.map(model => `
            <div class="ui segment">
                <h3 class="ui header">${model.name}</h3>
                <div class="ui statistics tiny">
                    <div class="statistic">
                        <div class="value">${model.stats.total_operations || 0}</div>
                        <div class="label">`+gettext('Total Operations')+`</div>
                    </div>
                    <div class="statistic">
                        <div class="value">${model.stats.total_prompt_tokens || 0}</div>
                        <div class="label">`+gettext('Total Prompt Tokens')+`</div>
                    </div>
                    <div class="statistic">
                        <div class="value">${model.stats.total_completion_tokens || 0}</div>
                        <div class="label">`+gettext('Total Completion Tokens')+`</div>
                    </div>
                    <div class="statistic">
                        <div class="value">${(model.stats.total_duration || 0).toFixed(2)}s</div>
                        <div class="label">`+gettext('Total Duration')+`</div>
                    </div>
                </div>
            </div>
        `).join('');

        $('#compareModal').modal('show');
    } catch (error) {
        showMessage(gettext('Error'), error.message, true);
    }
};

window.batchDeleteModels = async function() {
    const selectedModels = document.querySelectorAll('input[type="checkbox"]:checked');
    if (selectedModels.length === 0) {
        showMessage(gettext('Error'), gettext('Please select at least one model'), true);
        return;
    }

    let confirmText = gettext('Are you sure you want to delete');
    let confirmText2 = gettext('model(s)');
    if (!confirm(confirmText+` ${selectedModels.length} `+confirmText2+`?`)) {
        return;
    }

    const results = [];
    for (const checkbox of selectedModels) {
        const modelName = checkbox.getAttribute('data-model-name');
        try {
            const response = await fetch('/api/models/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Ollama-URL': ollamaUrl                },
                body: JSON.stringify({ name: modelName })
            });

            if(!response.ok) {
                const data = await response.json();
                let failureText = gettext('Failed to delete the model');
                throw new Error(data.error || failureText);
            }

            results.push({
                model: modelName,
                success: true,
                message: 'Supprimé avec succès'
            });
        } catch (error) {
            results.push({
                model:modelName,
                success: false,
                message: error.message
            });
        }
    }

    // Show results in batch results modal
    document.getElementById('batchResults').innerHTML = results.map(result => `
        <div class="ui message ${result.success ? 'positive' : 'negative'}">
            <div class="header">${result.model}</div>
            <p>${result.message}</p>
        </div>
    `).join('');

    $('#batchResultsModal').modal('show');
    refreshAll();
};

// Utility functions
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB','TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    checkServerStatus();
    refreshAll();

    // Set up search input events
    const searchInput = document.getElementById('modelSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
});

// Function to handle search input
async function handleSearch(e) {
    const searchInput = e.target;
    const query = searchInput.value.trim();
    const searchResults = document.querySelector('.ui.search-results');
    const searchResultsList = document.getElementById('searchResults');

    if (!query) {
        searchResults.style.display = 'none';
        return;
    }

    try {
        const words = query.toLowerCase().split(/\s+/);
        const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}`;
        const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const ggufModels = data.filter(model => model.tags?.includes('gguf') && words.every(word => model.id.toLowerCase().includes(word)));

        if (!ggufModels.length) {
            searchResultsList.innerHTML = '<div class="item">'+gettext('No models found')+'</div>';
            searchResults.style.display = 'block';
            return;
        }

        const modelsWithDate = ggufModels.map(model => {
            const createdAt = new Date(model.createdAt);
            const formattedDate = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`;
            return { ...model, formattedDate, createdAt: `${String(createdAt.getDate()).padStart(2, '0')}/${String(createdAt.getMonth() + 1).padStart(2, '0')}/${createdAt.getFullYear()}` };
        });

        modelsWithDate.sort((a, b) => new Date(b.formattedDate) - new Date(a.formattedDate));

        searchResultsList.innerHTML = modelsWithDate.map(model => `
            <div class="item" style="cursor: pointer;" onclick="selectModel('${model.id}')">
                <div class="content">
                    <div class="header">${model.id}</div>
                    <div class="description">`+gettext('Created on')+`: ${model.createdAt}</div>
                </div>
            </div>
        `).join('');

        searchResults.style.display = 'block';
    } catch (error) {
        showMessage(gettext('Error'), error.message, true);
    }
}

// Function to add a parameter in the config modal
window.addParameter = function() {
    const parametersContainer = document.getElementById('parameters');
    const newSegment = document.createElement('div');
    newSegment.className = 'ui segment';
    newSegment.innerHTML = `
        <div class="two fields">
            <div class="field">
                <input type="text" class="parameter-key" placeholder="`+gettext('Parameter Name')+`">
            </div>
            <div class="field">
                <div class="ui right labeled input">
                    <input type="text" class="parameter-value" placeholder="`+gettext('Value')+`">
                    <button class="ui icon button negative" onclick="removeParameter(this)">
                        <i class="trash icon"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    parametersContainer.appendChild(newSegment);
};

window.removeParameter = function(button) {
    const segment = button.closest('.ui.segment');
    if (segment) {
        segment.remove();
    }
};

window.saveModelConfig = async function() {
    const selectedModelsList = document.getElementById('selectedModels');
    const modelItems = selectedModelsList.getElementsByClassName('item');
    if (modelItems.length === 0) {
        showMessage(gettext('Error'), gettext('No models selected'), true);
        return;
    }

    // Get the model name from the first selected model
    const modelName = modelItems[0].textContent.trim();

    // Collect parameters
    const parameters = {};
    document.querySelectorAll('#parameters .ui.segment').forEach(segment => {
        const keyInput = segment.querySelector('.parameter-key');
        const valueInput = segment.querySelector('.parameter-value');
        if (keyInput && valueInput && keyInput.value.trim()) {
            parameters[keyInput.value.trim()] = valueInput.value.trim();
        }
    });

    // Build the configuration object
    const config = {
        system: document.getElementById('systemPrompt').value.trim(),
        template: document.getElementById('template').value.trim(),
        parameters: parameters
    };

    try {
        const response = await fetch(`/api/models/${modelName}/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Ollama-URL': ollamaUrl
            },
            body: JSON.stringify(config)
        });

        const data = await response.json();
        if (!response.ok) {
            let failureText = gettext('Failed to save the configuration');
            throw new Error(data.error || failureText+`: ${modelName}`);
        }

        $('#configModal').modal('hide');
        showMessage(gettext('Success'), gettext('Model configuration') +` ${modelName} `+ gettext('saved successfully'));
        refreshAll();
    } catch (error) {
        showMessage(gettext('Error'), error.message, true);
    }
};

// Server status check interval
setInterval(checkServerStatus, 30000);

// Update search results position on window resize and scroll
window.addEventListener('resize', updateSearchResultsPosition);
window.addEventListener('scroll', updateSearchResultsPosition);

// Initialize Semantic UI checkboxes and dropdowns
$('.ui.checkbox').checkbox();
$('.ui.dropdown').dropdown();