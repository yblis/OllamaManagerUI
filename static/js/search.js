// search.js
window.App = window.App || {};

App.searchTimeout = null;

App.initModelSearch = function() {
    const modelInput = document.getElementById('modelNameInput');
    const resultsContainer = document.querySelector('.ui.search-results');
    const searchResultsList = document.getElementById('searchResults');

    if (!modelInput || !resultsContainer || !searchResultsList) {
        console.error('Search elements not found.');
        return;
    }

    modelInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();
        if (App.searchTimeout) {
            clearTimeout(App.searchTimeout);
        }
        if (!query) {
            resultsContainer.style.display = 'none';
            return;
        }
        App.searchTimeout = setTimeout(() => {
            App.searchModels(query);
        }, 300);
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.ui.search')) {
            resultsContainer.style.display = 'none';
        }
    });
};

App.searchModels = async function(query) {
    const resultsContainer = document.querySelector('.ui.search-results');
    const searchResultsList = document.getElementById('searchResults');

    try {
        const response = await fetch(`${App.ollamaUrl}/api/v1/models?name=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${App.apiToken}`
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.models || data.models.length === 0) {
            resultsContainer.style.display = 'none';
            return;
        }

        searchResultsList.innerHTML = data.models.map(model => `
            <div class="item">
                <div class="content">
                    <div class="header">${App.escapeHTML(model.name)}</div>
                    <div class="description">
                        ${model.tags ? model.tags.map(tag => `
                            <button class="ui tiny basic button" data-model="${App.escapeHTML(model.name)}:${App.escapeHTML(tag)}">
                                ${App.escapeHTML(tag)}
                            </button>
                        `).join('') : ''}
                    </div>
                </div>
            </div>
        `).join('');

        resultsContainer.style.display = 'block';
    } catch (error) {
        App.showMessage('Error', error.message, true);
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    }
};

App.selectModel = function(modelName) {
    const modelInput = document.getElementById('modelNameInput');
    const resultsContainer = document.querySelector('.ui.search-results');

    if (modelInput && modelName) {
        modelInput.value = modelName;
    }

    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', App.initModelSearch);