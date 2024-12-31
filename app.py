from flask import g, Flask, render_template, jsonify, request, session, redirect, url_for
from flask_babel import Babel, refresh, gettext, ngettext, lazy_gettext
from flask_babel_js import BabelJS

from ollama_client import OllamaClient
import traceback
import requests
from functools import wraps
import time
import subprocess
import re
import os
import json

def get_locale():
    # try to guess the language from the user accept header the browser transmits
    default_lang = request.accept_languages.best_match(['fr', 'en'])
    if request.args.get('language'):
        session['language'] = request.args.get('language')
    return session.get('language', default_lang)

def get_timezone():
    user = getattr(g, 'user', None)
    if user is not None:
        return user.timezone
    return 'UT'

app = Flask(__name__)
app.config['BABEL_DEFAULT_LOCALE'] = os.environ.get('BABEL_DEFAULT_LOCALE', 'en')
babel = Babel(app, locale_selector=get_locale, timezone_selector=get_timezone)
babel_js = BabelJS(app)
ollama_client = OllamaClient()

app.config['LANGUAGES'] =  {
    'en': 'English',
    'fr': 'French',
}
app.secret_key = os.environ.get('OMM_SECRET_KEY', 'super secret key')

@app.context_processor
def inject_conf_var():
    return dict(AVAILABLE_LANGUAGES=app.config['LANGUAGES'], CURRENT_LANGUAGE=session.get('language', request.accept_languages.best_match(app.config['LANGUAGES'].keys())))

def change_locale(lang):
    g.user['locale'] = lang
    refresh()

def with_error_handling(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except requests.exceptions.ConnectionError:
            return jsonify({
                'error': 'Impossible de se connecter au serveur Ollama. Veuillez vérifier l\'URL du serveur dans les paramètres.',
                'status': 'connection_error'
            }), 503
        except Exception as e:
            print(f"Error in {f.__name__}: {str(e)}")
            print(traceback.format_exc())
            return jsonify({
                'error': str(e),
                'status': 'error'
            }), 500
    return decorated_function

@app.before_request
def before_request():
    global ollama_client
    # First try to get URL from headers, then environment, then default
    base_url = request.headers.get('X-Ollama-URL')
    if not base_url:
        base_url = os.environ.get('OLLAMA_SERVER_URL', 'http://localhost:11434')

    # Ensure URL has correct format
    if base_url.endswith('/'):
        base_url = base_url[:-1]
    if not base_url.startswith('http'):
        base_url = 'http://' + base_url

    print(f"Using Ollama server URL: {base_url}")
    ollama_client = OllamaClient(base_url=base_url)

@app.route('/')
def index():
    return render_template('index.html', server_status=False)

@app.route('/language=<language>')
def set_language(language=None):
    session['language'] = language
    return redirect(url_for('index'))

@app.route('/api/server/url')
def get_server_url():
    """Get the Ollama server URL from environment"""
    url = os.environ.get('OLLAMA_SERVER_URL', 'http://localhost:11434')
    return jsonify({'url': url})

@app.route('/api/server/status')
@with_error_handling
def server_status():
    status = ollama_client.check_server()
    return jsonify({'status': 'running' if status else 'stopped'})

@app.route('/api/models', methods=['GET'])
@with_error_handling
def get_models():
    response = ollama_client.list_models()
    if 'error' in response:
        return jsonify({'error': response['error']}), 503
    return jsonify(response)

@app.route('/api/models/running', methods=['GET'])
@with_error_handling
def get_running_models():
    response = ollama_client.list_running()
    if 'error' in response:
        return jsonify({'error': response['error']}), 503
    return jsonify(response)

@app.route('/api/models/stop', methods=['POST'])
@with_error_handling
def stop_model():
    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 400
        
    model_name = request.json.get('name')
    if not model_name:
        return jsonify({
            'error': 'Le nom du modèle est requis',
            'status': 'validation_error'
        }), 400
    
    result = ollama_client.stop_model(model_name)
    if not result.get('success'):
        return jsonify({
            'error': result.get('error', 'Erreur inconnue'),
            'status': 'error'
        }), 500
    return jsonify(result)

@app.route('/api/models/delete', methods=['POST'])
@with_error_handling
def delete_model():
    model_name = request.json.get('name')
    if not model_name:
        return jsonify({
            'error': 'Le nom du modèle est requis',
            'status': 'validation_error'
        }), 400
    
    result = ollama_client.delete_model(model_name)
    if not result.get('success'):
        return jsonify({
            'error': result.get('error', 'Erreur inconnue'),
            'status': 'error'
        }), 500
    return jsonify(result)

@app.route('/api/models/pull', methods=['POST'])
@with_error_handling
def pull_model():
    model_name = request.json.get('name')
    if not model_name:
        return jsonify({
            'error': 'Le nom du modèle est requis',
            'status': 'validation_error'
        }), 400
        
    try:
        url = f'{ollama_client.base_url}/api/pull'
        response = requests.post(url, 
            headers=ollama_client._get_headers(),
            json={'name': model_name},
            stream=True)
        
        response.raise_for_status()
        
        # Process the streaming response
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line)
                    # If we get a success status, break the loop
                    if data.get('status') == 'success':
                        break
                except json.JSONDecodeError:
                    continue
                    
        return jsonify({'success': True, 'message': f'Successfully pulled model {model_name}'})
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/search', methods=['POST'])
@with_error_handling
def search_models():
    keyword = request.json.get('keyword', '')
    try:
        # Use curl to get models directly
        result = subprocess.run(['curl', '-s', 'https://ollama.com/library'], capture_output=True, text=True)
        if result.returncode != 0:
            return jsonify({'error': 'Erreur de connexion à la bibliothèque Ollama'}), 500
            
        # Extract model names using regex
        pattern = r'(?<=<span>).*?(?=</span>)'
        models = re.findall(pattern, result.stdout)
        
        # Filter models based on keyword
        filtered_models = [model for model in models if keyword.lower() in model.lower()]
        
        # Common model size tags
        size_tags = ['1b', '1.5b', '2b', '3b', '7b', '8b', '9b', '13b', '34b', '70b']
        
        # Prepare response with models and their tags
        models_with_tags = [{'name': model, 'tags': size_tags} for model in filtered_models]
        
        return jsonify({'models': models_with_tags})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/stats', methods=['GET'])
@with_error_handling
def get_all_model_stats():
    stats = ollama_client.get_model_stats()
    return jsonify(stats)

@app.route('/api/models/<model_name>/stats', methods=['GET'])
@with_error_handling
def get_model_stats(model_name):
    return jsonify(ollama_client.get_model_stats(model_name))

@app.route('/api/models/<model_name>/config', methods=['GET'])
@with_error_handling
def get_model_config(model_name):
    config = ollama_client.get_model_config(model_name)
    if 'error' in config:
        return jsonify({'error': config['error']}), 500
    return jsonify(config)


@app.route('/api/models/<model_name>/config', methods=['POST'])
@with_error_handling
def save_model_config(model_name):
    """Save model configuration"""
    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 400
        
    data = request.json
    result = ollama_client.save_model_config(
        model_name,
        system=data.get('system'),
        template=data.get('template'),
        parameters=data.get('parameters')
    )
    
    if not result.get('success'):
        return jsonify({
            'error': result.get('error', 'Erreur inconnue'),
            'status': 'error'
        }), 500
        
    return jsonify(result)

@app.errorhandler(Exception)
def handle_error(error):
    print(f"Unhandled error: {str(error)}")
    print(traceback.format_exc())
    return jsonify({
        'error': str(error),
        'status': 'error'
    }), 500

if __name__ == '__main__':
    print(f"Starting Flask server with Ollama URL: {os.environ.get('OLLAMA_SERVER_URL', 'default URL not set')}")
    app.run(host='0.0.0.0', port=5000, debug=True)