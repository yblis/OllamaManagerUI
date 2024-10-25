// ... previous code remains the same until displayModels function ...

// Display models
function displayModels(models, containerId, errorMessage = null) {
    const container = document.getElementById(containerId);
    const tbody = container.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (errorMessage) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="ui warning message">${errorMessage}</div></td></tr>`;
        return;
    }
    
    if (models.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="ui message">No models found</div></td></tr>';
        return;
    }
    
    for (const model of models) {
        const tr = document.createElement('tr');
        
        // Add checkbox column for local models
        if (containerId === 'localModels') {
            tr.innerHTML = `
                <td class="collapsing">
                    <div class="ui fitted checkbox">
                        <input type="checkbox" data-model="${model.name}">
                        <label></label>
                    </div>
                </td>
            `;
        }
        
        tr.innerHTML += `
            <td>${model.name}</td>
            <td>${model.modified_at}</td>
            <td>${formatSize(model.size)}</td>
            <td>${model.details?.format || ''}</td>
            <td>${model.details?.family || ''}</td>
            <td>${model.details?.parameter_size || ''}</td>
            <td class="center aligned">
                <div class="ui tiny buttons">
                    <button class="ui primary button" onclick="showModelStats('${model.name}')">
                        <i class="chart bar icon"></i> Stats
                    </button>
                    <button class="ui teal button" onclick="showModelConfig('${model.name}')">
                        <i class="cog icon"></i> Config
                    </button>
                    <button class="ui negative button" onclick="deleteModel('${model.name}')">
                        <i class="trash icon"></i> Delete
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });

    // Initialize checkboxes
    $('.ui.checkbox').checkbox();
}

// ... rest of the code remains the same ...
