# Gestionnaire de Modèles Ollama

![Interface du Gestionnaire de Modèles Ollama](attached_assets/image_1735502375301.png)

## Description
Une interface web pour gérer vos modèles Ollama, construite avec Flask et Semantic UI.

## Fonctionnalités
- Gestion des modèles (téléchargement, suppression, configuration)
- Mode sombre/clair
- Interface responsive
- Statistiques d'utilisation des modèles
- Configuration des modèles
- Opérations par lots
- Comparaison de modèles

## Prérequis
- Python 3.8+
- Ollama installé et en cours d'exécution
- pip ou un autre gestionnaire de paquets Python

## Installation
1. Cloner le dépôt
```bash
git clone https://github.com/yblis/OllamaManagerUI.git
cd OllamaManagerUI
```

2. Installer les dépendances
```bash
pip install -r requirements.txt
```

3. Configuration
- Créer un fichier .env et configurer l'URL du serveur Ollama :
```bash
OLLAMA_SERVER_URL=http://localhost:11434
```

4. Lancer l'application
```bash
python main.py
```

L'application sera accessible à l'adresse http://localhost:5000

## Utilisation
- Accédez à l'interface web via votre navigateur
- Utilisez le bouton de thème en haut à gauche pour basculer entre les modes clair et sombre
- Gérez vos modèles via l'interface intuitive
- Consultez les statistiques d'utilisation
- Configurez vos modèles individuellement ou en lot

## Python Virtual Environment
```
source venv/bin/activate
```

## Translations
1. To generate the translation file for all the strings in the project
```
pybabel extract -F babel.cfg -k lazy_gettext -o messages.pot .
```

2. To create a brand new translation for a new language
```
pybabel init -i messages.pot -d translations -l fr
```

3. To update the translation file with new translations
```
pybabel update -i messages.pot -d translations
```

4. Re-compile the translations
```
pybabel compile -d translations
```

## Contribution
Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## Licence
MIT
