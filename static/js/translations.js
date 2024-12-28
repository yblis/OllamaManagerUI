// Translations for the application
const translations = {
    'fr': {
        // Settings
        'settings': 'Paramètres',
        'language': 'Langue',
        'theme': 'Thème',
        'server_url': 'URL du Serveur',
        'save': 'Enregistrer',
        'cancel': 'Annuler',
        'dark_mode': 'Mode Sombre',
        'light_mode': 'Mode Clair',
        'french': 'Français',
        'english': 'English',
        
        // Model Management
        'download_new_model': 'Télécharger un Nouveau Modèle',
        'enter_model_name': 'Entrez le nom du modèle (ex: llama2:7b)',
        'download': 'Télécharger',
        'downloading': 'Démarrage du téléchargement...',
        'local_models': 'Modèles Locaux',
        'running_models': 'Modèles en Cours d\'Exécution',
        'refresh': 'Actualiser',
        
        // Table Headers
        'model_name': 'Nom du Modèle',
        'modified_date': 'Date de Modification',
        'size': 'Taille',
        'format': 'Format',
        'family': 'Famille',
        'parameters': 'Paramètres',
        'actions': 'Actions',
        
        // Actions
        'delete_selection': 'Supprimer la Sélection',
        'configure_selection': 'Configurer la Sélection',
        'compare_selection': 'Comparer la Sélection',
        'select_all': 'Tout Sélectionner',
        'stop': 'Arrêter',
        'delete': 'Supprimer',
        'config': 'Config',
        'stats': 'Stats',
        
        // Messages
        'confirm_delete': 'Êtes-vous sûr de vouloir supprimer',
        'success': 'Succès',
        'error': 'Erreur',
        'model_deleted': 'Modèle supprimé avec succès',
        'model_downloaded': 'Modèle téléchargé avec succès',
        'select_min_two_models': 'Veuillez sélectionner au moins deux modèles à comparer',
        'no_models': 'Aucun modèle installé',
        'server_not_connected': 'Serveur Ollama non connecté',
        'loading_details': 'Chargement des détails...',
        
        // Statistics
        'total_operations': 'Opérations Totales',
        'prompt_tokens': 'Tokens de Prompt',
        'completion_tokens': 'Tokens de Complétion',
        'total_duration': 'Durée Totale',
        'operations_by_type': 'Opérations par Type',
        'operations': 'opération(s)'
    },
    'en': {
        // Settings
        'settings': 'Settings',
        'language': 'Language',
        'theme': 'Theme',
        'server_url': 'Server URL',
        'save': 'Save',
        'cancel': 'Cancel',
        'dark_mode': 'Dark Mode',
        'light_mode': 'Light Mode',
        'french': 'French',
        'english': 'English',
        
        // Model Management
        'download_new_model': 'Download New Model',
        'enter_model_name': 'Enter model name (e.g., llama2:7b)',
        'download': 'Download',
        'downloading': 'Starting download...',
        'local_models': 'Local Models',
        'running_models': 'Running Models',
        'refresh': 'Refresh',
        
        // Table Headers
        'model_name': 'Model Name',
        'modified_date': 'Modified Date',
        'size': 'Size',
        'format': 'Format',
        'family': 'Family',
        'parameters': 'Parameters',
        'actions': 'Actions',
        
        // Actions
        'delete_selection': 'Delete Selection',
        'configure_selection': 'Configure Selection',
        'compare_selection': 'Compare Selection',
        'select_all': 'Select All',
        'stop': 'Stop',
        'delete': 'Delete',
        'config': 'Config',
        'stats': 'Stats',
        
        // Messages
        'confirm_delete': 'Are you sure you want to delete',
        'success': 'Success',
        'error': 'Error',
        'model_deleted': 'Model deleted successfully',
        'model_downloaded': 'Model downloaded successfully',
        'select_min_two_models': 'Please select at least two models to compare',
        'no_models': 'No models installed',
        'server_not_connected': 'Ollama server not connected',
        'loading_details': 'Loading details...',
        
        // Statistics
        'total_operations': 'Total Operations',
        'prompt_tokens': 'Prompt Tokens',
        'completion_tokens': 'Completion Tokens',
        'total_duration': 'Total Duration',
        'operations_by_type': 'Operations by Type',
        'operations': 'operation(s)'
    }
};

// Current language
let currentLang = localStorage.getItem('language') || 'fr';

// Translation function
function t(key) {
    return translations[currentLang][key] || key;
}

// Change language function
function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('language', lang);
    updateUIText();
}

// Function to update all UI text
function updateUIText() {
    // Update all text elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key) {
            if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
                element.placeholder = t(key);
            } else {
                element.textContent = t(key);
            }
        }
    });
}

// Initialize translations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    updateUIText();
});
