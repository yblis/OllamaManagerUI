// Previous code remains the same...

async function searchAndPullModel() {
    const modelName = document.getElementById('modelNameInput').value;
    if (!modelName) {
        return;
    }

    try {
        const searchResponse = await fetch('/api/models/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: modelName })
        });
        
        if (!searchResponse.ok) throw new Error('Erreur lors de la recherche');
        const searchData = await searchResponse.json();
        
        const searchResults = document.getElementById('searchResults');
        const searchResultsContainer = document.querySelector('.search-results');
        
        if (searchData.models && searchData.models.length > 0) {
            searchResults.innerHTML = searchData.models.map(model => `
                <div class="item">
                    <div class="content">
                        <div class="header">${model.name}</div>
                        <div class="description">
                            <div class="ui labels">
                                ${model.tags.map(tag => `
                                    <div class="ui label">
                                        ${tag}
                                        <button class="ui mini primary button" onclick="pullModel('${model.name}:${tag}')">
                                            <i class="download icon"></i>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
            searchResultsContainer.style.display = 'block';
        } else {
            searchResults.innerHTML = '<div class="ui message">Aucun modèle trouvé</div>';
            searchResultsContainer.style.display = 'block';
        }
    } catch (error) {
        showMessage('Erreur', error.message, true);
        const searchResultsContainer = document.querySelector('.search-results');
        searchResultsContainer.style.display = 'none';
    }
}

// Rest of the file remains the same...
