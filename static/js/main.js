// Initialize Element UI with French locale
ELEMENT.locale(ELEMENT.lang.fr);

// Vue instance
new Vue({
    el: '#app',
    data: {
        activeIndex: '1',
        isDarkMode: localStorage.getItem('theme') === 'dark',
        ollamaUrl: localStorage.getItem('ollamaUrl') || 'http://localhost:11434',
        serverStatus: false,
        serverStatusMessage: 'Vérification du statut du serveur...',
        modelName: '',
        searchResults: [],
        showSearchResults: false,
        showProgress: false,
        downloadProgress: 0,
        progressStatus: '',
        settingsVisible: false,
        statsDialogVisible: false,
        configDialogVisible: false,
        comparisonDialogVisible: false,
        localModels: [],
        runningModels: [],
        selectedModels: [],
        overallStats: [],
        modelStats: [],
        settingsForm: {
            ollamaUrl: ''
        },
        configForm: {
            systemPrompt: '',
            template: '',
            parameters: []
        }
    },
    computed: {
        themeIcon() {
            return this.isDarkMode ? 'el-icon-moon' : 'el-icon-sunny';
        }
    },
    watch: {
        isDarkMode(newValue) {
            const theme = newValue ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        }
    },
    methods: {
        // Original methods
        toggleTheme() {
            this.isDarkMode = !this.isDarkMode;
        },

        async checkServerStatus() {
            try {
                const response = await fetch('/api/server/status', {
                    headers: { 'X-Ollama-URL': this.ollamaUrl }
                });
                const data = await response.json();
                this.serverStatus = data.status === 'running';
                this.serverStatusMessage = this.serverStatus 
                    ? 'Le serveur Ollama est en cours d\'exécution'
                    : 'Le serveur Ollama est arrêté';
            } catch (error) {
                console.error('Error checking server status:', error);
                this.serverStatus = false;
                this.serverStatusMessage = 'Erreur de connexion au serveur';
            }
        },

        formatDate(dateString) {
            if (!dateString) return 'N/A';
            try {
                return new Date(dateString).toLocaleString('fr-FR');
            } catch {
                return 'N/A';
            }
        },

        formatBytes(bytes, decimals = 2) {
            if (!bytes || bytes === 0) return '0 Bytes';
            try {
                const k = 1024;
                const dm = decimals < 0 ? 0 : decimals;
                const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
            } catch {
                return '0 Bytes';
            }
        },

        async stopModel(modelName) {
            try {
                const result = await this.$confirm(
                    `Êtes-vous sûr de vouloir arrêter le modèle ${modelName} ?`,
                    'Confirmation',
                    {
                        confirmButtonText: 'Oui',
                        cancelButtonText: 'Non',
                        type: 'warning'
                    }
                );

                if (result !== 'confirm') return;

                const response = await fetch('/api/models/stop', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Ollama-URL': this.ollamaUrl
                    },
                    body: JSON.stringify({ name: modelName })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Échec de l\'arrêt du modèle');
                }

                this.$message({
                    message: `Modèle ${modelName} arrêté avec succès`,
                    type: 'success'
                });

                await this.refreshRunningModels();
            } catch (error) {
                console.error('Error stopping model:', error);
                this.$message({
                    message: error.message,
                    type: 'error'
                });
            }
        },

        async refreshLocalModels() {
            try {
                const response = await fetch('/api/models', {
                    headers: { 'X-Ollama-URL': this.ollamaUrl }
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to fetch local models');
                }
                
                const data = await response.json();
                this.localModels = data.models || [];
            } catch (error) {
                console.error('Error refreshing local models:', error);
                this.$message({
                    message: error.message,
                    type: 'error'
                });
            }
        },

        async refreshRunningModels() {
            try {
                const response = await fetch('/api/models/running', {
                    headers: { 'X-Ollama-URL': this.ollamaUrl }
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to fetch running models');
                }
                
                const data = await response.json();
                this.runningModels = data.models || [];
            } catch (error) {
                console.error('Error refreshing running models:', error);
                this.$message({
                    message: error.message,
                    type: 'error'
                });
            }
        },

        async refreshStats() {
            try {
                const response = await fetch('/api/models/stats', {
                    headers: { 'X-Ollama-URL': this.ollamaUrl }
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to fetch stats');
                }

                const stats = await response.json();
                this.overallStats = [
                    { label: 'Opérations Totales', value: stats.total_operations || 0 },
                    { label: 'Tokens de Prompt', value: stats.total_prompt_tokens || 0 },
                    { label: 'Tokens de Complétion', value: stats.total_completion_tokens || 0 },
                    { label: 'Durée Totale', value: `${(stats.total_duration || 0).toFixed(2)}s` }
                ];
            } catch (error) {
                console.error('Error refreshing stats:', error);
                this.$message({
                    message: error.message,
                    type: 'error'
                });
            }
        },

        async refreshAll() {
            await Promise.all([
                this.refreshLocalModels(),
                this.refreshRunningModels(),
                this.refreshStats()
            ]);
        },

        handleSelectionChange(selection) {
            this.selectedModels = selection;
        },

        // New methods from manager's message
        showSettings() {
            this.settingsVisible = true;
        },
        
        async pullModel() {
            if (!this.modelName) {
                this.$message.warning('Veuillez entrer un nom de modèle');
                return;
            }
            
            try {
                this.showProgress = true;
                this.progressStatus = 'active';
                const response = await fetch('/api/models/pull', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Ollama-URL': this.ollamaUrl
                    },
                    body: JSON.stringify({ name: this.modelName })
                });
                
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to pull model');
                }
                
                this.$message.success(`Modèle ${this.modelName} téléchargé avec succès`);
                this.modelName = '';
                await this.refreshLocalModels();
            } catch (error) {
                console.error('Error pulling model:', error);
                this.$message.error(error.message);
            } finally {
                this.showProgress = false;
            }
        },
        
        async batchDeleteModels() {
            if (!this.selectedModels.length) {
                this.$message.warning('Veuillez sélectionner des modèles à supprimer');
                return;
            }
            
            try {
                const result = await this.$confirm(
                    'Êtes-vous sûr de vouloir supprimer les modèles sélectionnés ?',
                    'Confirmation',
                    {
                        confirmButtonText: 'Oui',
                        cancelButtonText: 'Non',
                        type: 'warning'
                    }
                );
                
                if (result !== 'confirm') return;
                
                for (const model of this.selectedModels) {
                    await fetch('/api/models/delete', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Ollama-URL': this.ollamaUrl
                        },
                        body: JSON.stringify({ name: model.name })
                    });
                }
                
                this.$message.success('Modèles supprimés avec succès');
                await this.refreshLocalModels();
            } catch (error) {
                console.error('Error deleting models:', error);
                this.$message.error(error.message);
            }
        },
        
        batchConfigureModels() {
            if (!this.selectedModels.length) {
                this.$message.warning('Veuillez sélectionner des modèles à configurer');
                return;
            }
            this.configDialogVisible = true;
        },
        
        compareSelectedModels() {
            if (this.selectedModels.length < 2) {
                this.$message.warning('Veuillez sélectionner au moins deux modèles à comparer');
                return;
            }
            this.comparisonDialogVisible = true;
        },
        
        toggleAllModels() {
            const toggleTo = this.selectedModels.length !== this.localModels.length;
            this.$refs.localModelsTable.toggleAllSelection(toggleTo);
        }
    },
    mounted() {
        // Initialize theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.isDarkMode = savedTheme === 'dark';

        // Start periodic checks
        this.checkServerStatus();
        this.refreshAll();
        setInterval(this.checkServerStatus, 30000);
        setInterval(this.refreshRunningModels, 30000);
    }
});
