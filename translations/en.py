"""English translations for the Ollama Manager UI"""

translations = {
    # Page titles and headers
    "app_title": "Ollama Manager",
    "settings": "Settings",
    "server_url": "Ollama Server URL",
    "interface_theme": "Interface Theme",
    "language_selection": "Language / Langue",

    # Model management
    "download_model": "Download a New Model",
    "enter_model_name": "Enter model name (e.g. llama2:7b)",
    "download": "Download",
    "starting_download": "Starting download...",
    "local_models": "Local Models",
    "running_models": "Running Models",

    # Actions and buttons
    "delete_selected": "Delete Selection",
    "configure_selected": "Configure Selection",
    "compare_selected": "Compare Selection",
    "select_all": "Select All",
    "refresh": "Refresh",
    "save": "Save",
    "cancel": "Cancel",
    "close": "Close",
    "stop": "Stop",

    # Model properties
    "model_name": "Model Name",
    "created_date": "Creation Date",
    "modified_date": "Modified Date",
    "size": "Size",
    "format": "Format",
    "family": "Family",
    "parameters": "Parameters",
    "actions": "Actions",

    # Messages
    "no_models": "No models installed",
    "no_running_models": "No models currently running",
    "server_not_connected": "Ollama server not connected",
    "cannot_fetch_models": "Unable to fetch models",

    # Confirmations
    "confirm_stop": "Are you sure you want to stop the model {model_name}?",
    "confirm_delete": "Are you sure you want to delete the model {model_name}?",
    "confirm_batch_delete": "Are you sure you want to delete {count} model(s)?",

    # Success messages
    "model_stopped": "Model {model_name} stopped successfully",
    "model_deleted": "Model {model_name} deleted successfully",
    "model_downloaded": "Model {model_name} downloaded successfully",
    "settings_saved": "Settings saved successfully",

    # Error messages
    "error": "Error",
    "error_stopping": "Failed to stop model",
    "error_deleting": "Failed to delete model",
    "error_downloading": "Download failed",
    "select_models": "Please select at least one model",
    "select_two_models": "Please select at least two models to compare",

    # Statistics
    "total_operations": "Total Operations",
    "prompt_tokens": "Prompt Tokens",
    "completion_tokens": "Completion Tokens",
    "total_duration": "Total Duration",
    "operations_by_type": "Operations by Type",
    "operation_count": "{count} operation(s)"
}