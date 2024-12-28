// Variable globale pour le timeout de recherche
let searchTimeout = null;

function initModelSearch() {
    const modelInput = document.getElementById('modelNameInput');
    const resultsContainer = document.querySelector('.results');

    if (!modelInput) {
        console.error('Element de recherche non trouvé: modelNameInput');
        return;
    }

    modelInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();

        // Annuler la recherche précédente
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // Cacher les résultats si la requête est vide
        if (!query) {
            if (resultsContainer) {
                resultsContainer.style.display = 'none';
            }
            return;
        }

        // Attendre que l'utilisateur arrête de taper
        searchTimeout = setTimeout(() => {
            searchModels(query);
        }, 300);
    });

    // Cacher les résultats quand on clique ailleurs
    document.addEventListener('click', function(e) {
        if (resultsContainer && !e.target.closest('.ui.search')) {
            resultsContainer.style.display = 'none';
        }
    });
}

async function searchModels(query) {
    const resultsContainer = document.querySelector('.results');
    if (!resultsContainer) {
        console.error('Container de résultats non trouvé: .results');
        return;
    }

    try {
        const response = await fetch('/api/models/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ keyword: query })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displaySearchResults(data.models);
    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    }
}

function displaySearchResults(models) {
    const resultsContainer = document.querySelector('.results');
    if (!resultsContainer) {
        console.error('Container de résultats non trouvé: .results');
        return;
    }

    if (!models || models.length === 0) {
        resultsContainer.style.display = 'none';
        return;
    }

    let html = '<div class="ui relaxed divided list">';

    models.forEach(model => {
        const name = model.name || '';
        const description = model.description || '';
        const modelSize = model.model_size || '';
        const family = model.family || '';

        html += `
            <div class="item" onclick="selectModel('${name}')">
                <div class="content">
                    <div class="header">${name}</div>
                    <div class="description">
                        ${description}
                        ${modelSize ? `<span class="ui tiny label">${modelSize}</span>` : ''}
                        ${family ? `<span class="ui tiny label">${family}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
}

function selectModel(modelName) {
    const modelInput = document.getElementById('modelNameInput');
    const resultsContainer = document.querySelector('.results');

    if (modelInput && modelName) {
        modelInput.value = modelName;
    }

    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
}

// Initialiser la recherche au chargement de la page
document.addEventListener('DOMContentLoaded', initModelSearch);