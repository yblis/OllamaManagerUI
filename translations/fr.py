"""French translations for the Ollama Manager UI"""

translations = {
    # Page titles and headers
    "app_title": "Gestionnaire Ollama",
    "settings": "Paramètres",
    "server_url": "URL du Serveur Ollama",
    "interface_theme": "Thème de l'interface",
    "language_selection": "Langue / Language",

    # Model management
    "download_model": "Télécharger un Nouveau Modèle",
    "enter_model_name": "Entrez le nom du modèle (ex: llama2:7b)",
    "download": "Télécharger",
    "starting_download": "Démarrage du téléchargement...",
    "local_models": "Modèles Locaux",
    "running_models": "Modèles en Cours d'Exécution",

    # Actions and buttons
    "delete_selected": "Supprimer la Sélection",
    "configure_selected": "Configurer la Sélection",
    "compare_selected": "Comparer la Sélection",
    "select_all": "Tout Sélectionner",
    "refresh": "Actualiser",
    "save": "Enregistrer",
    "cancel": "Annuler",
    "close": "Fermer",
    "stop": "Arrêter",

    # Model properties
    "model_name": "Nom du Modèle",
    "modified_date": "Date de Modification",
    "size": "Taille",
    "format": "Format",
    "family": "Famille",
    "parameters": "Paramètres",
    "actions": "Actions",

    # Messages
    "no_models": "Aucun modèle installé",
    "no_running_models": "Aucun modèle en cours d'exécution",
    "server_not_connected": "Serveur Ollama non connecté",
    "cannot_fetch_models": "Impossible de récupérer les modèles",

    # Confirmations
    "confirm_stop": "Êtes-vous sûr de vouloir arrêter le modèle {model_name} ?",
    "confirm_delete": "Êtes-vous sûr de vouloir supprimer le modèle {model_name} ?",
    "confirm_batch_delete": "Êtes-vous sûr de vouloir supprimer {count} modèle(s) ?",

    # Success messages
    "model_stopped": "Modèle {model_name} arrêté avec succès",
    "model_deleted": "Modèle {model_name} supprimé avec succès",
    "model_downloaded": "Modèle {model_name} téléchargé avec succès",
    "settings_saved": "Paramètres enregistrés avec succès",

    # Error messages
    "error": "Erreur",
    "error_stopping": "Échec de l'arrêt du modèle",
    "error_deleting": "Échec de la suppression du modèle",
    "error_downloading": "Échec du téléchargement",
    "select_models": "Veuillez sélectionner au moins un modèle",
    "select_two_models": "Veuillez sélectionner au moins deux modèles à comparer",

    # Statistics
    "total_operations": "Opérations Totales",
    "prompt_tokens": "Tokens de Prompt",
    "completion_tokens": "Tokens de Complétion",
    "total_duration": "Durée Totale",
    "operations_by_type": "Opérations par Type",
    "operation_count": "{count} opération(s)"
}