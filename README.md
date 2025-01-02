# Ollama Model Manager

![Ollama Model Manager Interface](ollama_manager.png)

## Description
A web interface to manage your Ollama models, built with Flask and Semantic UI.

## Features
- Model management (download, delete, configure)
- Dark/Light mode
- Responsive interface
- Model usage statistics
- Model configuration
- Batch operations
- Model comparison
- Model downloads from Hugging Face and ollama.com

## Requirements
- Python 3.8+
- Ollama installed and running
- pip or another Python package manager

## Installation
1. Clone the repository:
```bash
git clone https://github.com/yblis/OllamaManagerUI.git
cd OllamaManagerUI
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configuration:
- Create a .env file and configure the Ollama server URL:
```bash
OLLAMA_SERVER_URL=http://localhost:11434
```

4. Start the application:
```bash
python main.py
```

The application will be accessible at http://localhost:5000

## Usage
- Access the web interface through your browser
- Use the theme button at the top left to switch between light and dark modes
- Manage your models through the intuitive interface
- View usage statistics
- Configure models individually or in batches

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
Contributions are welcome! Feel free to open an issue or a pull request.

## License
MIT

