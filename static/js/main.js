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
