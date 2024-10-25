[Previous content retained...]

// Model management functions
window.showModelConfig = async function(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/config`);
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
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
        showMessage('Erreur', error.message, true);
    }
};

window.deleteModel = async function(modelName) {
    try {
        const response = await fetch('/api/models/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Échec de la suppression du modèle');
        }
        
        showMessage('Succès', `Modèle ${modelName} supprimé avec succès`);
        refreshAll();
    } catch (error) {
        showMessage('Erreur', error.message, true);
    }
};

window.showModelStats = async function(modelName) {
    try {
        const response = await fetch(`/api/models/${modelName}/stats`);
        if (!response.ok) throw new Error(`Erreur HTTP ! statut : ${response.status}`);
        const stats = await response.json();
        
        document.getElementById('modelStats').innerHTML = `
            <div class="ui statistics">
                <div class="statistic">
                    <div class="value">${stats.total_operations || 0}</div>
                    <div class="label">Opérations Totales</div>
                </div>
                <div class="statistic">
                    <div class="value">${stats.total_prompt_tokens || 0}</div>
                    <div class="label">Tokens de Prompt</div>
                </div>
                <div class="statistic">
                    <div class="value">${stats.total_completion_tokens || 0}</div>
                    <div class="label">Tokens de Complétion</div>
                </div>
                <div class="statistic">
                    <div class="value">${(stats.total_duration || 0).toFixed(2)}s</div>
                    <div class="label">Durée Totale</div>
                </div>
            </div>
            
            <div class="ui segment">
                <h4 class="ui header">Opérations par Type</h4>
                <div class="ui list">
                    ${Object.entries(stats.operations_by_type || {}).map(([type, count]) => `
                        <div class="item">
                            <i class="right triangle icon"></i>
                            <div class="content">
                                <div class="header">${type}</div>
                                <div class="description">${count} opération(s)</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        $('#statsModal').modal('show');
    } catch (error) {
        showMessage('Erreur', error.message, true);
    }
};
