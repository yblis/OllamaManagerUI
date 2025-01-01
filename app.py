import requests
from flask import g, Flask, render_template, jsonify, request, session, redirect, url_for
from flask_babel import Babel, refresh, gettext, ngettext, lazy_gettext
from flask_babel_js import BabelJS
from ollama_client import OllamaClient
import traceback
import os
import json
from translations import t, get_translation, set_language, get_available_languages, DEFAULT_LANGUAGE
from bs4 import BeautifulSoup
from functools import wraps

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


# Use a more secure configuration for session cookies
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=86400  # 24 hours
)

app.config['LANGUAGES'] =  {
    'en': 'English',
    'fr': 'French',
}

app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev_key_123')  # Required for session

# Register translation function for templates
app.jinja_env.globals.update(t=t)

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
                'error': t('server_not_connected'),
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

    # Debug: Print all session data
    print("Current session data:", dict(session))

    # Initialize language if not set
    if 'language' not in session:
        session['language'] = DEFAULT_LANGUAGE
        session.modified = True
        print(f"Initialized default language: {DEFAULT_LANGUAGE}")

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
    # Debug: Print current language and session info
    print(f"Current language from session: {session.get('language', 'Not set')}")
    print(f"All cookies: {request.cookies}")
    print(f"Session cookie: {request.cookies.get('session')}")
    return render_template('index.html')

@app.route('/api/language', methods=['POST'])
def change_language():
    """Change the application language"""
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400

        data = request.json
        lang = data.get('language')
        if not lang:
            return jsonify({'error': 'Language parameter is required'}), 400

        available_languages = get_available_languages()
        print(f"Available languages: {available_languages}")
        print(f"Requested language: {lang}")

        if lang not in available_languages:
            return jsonify({'error': f'Invalid language code. Available languages: {", ".join(available_languages)}'}), 400

        # Update session language
        session['language'] = lang
        session.modified = True

        # Debug: Print updated session data
        print(f"Language changed to: {lang}")
        print("Updated session data:", dict(session))

        return jsonify({
            'success': True,
            'message': 'Language changed successfully',
            'language': lang
        })

    except Exception as e:
        print(f"Error changing language: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

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
            'error': t('select_models'),
            'status': 'validation_error'
        }), 400

    result = ollama_client.stop_model(model_name)
    if not result.get('success'):
        return jsonify({
            'error': result.get('error', t('error_stopping')),
            'status': 'error'
        }), 500
    return jsonify(result)

@app.route('/api/models/delete', methods=['POST'])
@with_error_handling
def delete_model():
    model_name = request.json.get('name')
    if not model_name:
        return jsonify({
            'error': t('select_models'),
            'status': 'validation_error'
        }), 400

    result = ollama_client.delete_model(model_name)
    if not result.get('success'):
        return jsonify({
            'error': result.get('error', t('error_deleting')),
            'status': 'error'
        }), 500
    return jsonify(result)

@app.route('/api/models/pull', methods=['POST'])
@with_error_handling
def pull_model():
    model_name = request.json.get('name')
    if not model_name:
        return jsonify({
            'error': t('select_models'),
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
    source = request.json.get('source', 'huggingface')
    selected_filters = request.json.get('filters', [])

    try:
        if source == 'huggingface':
            # Recherche HuggingFace existante
            words = keyword.lower().split()
            url = f"https://huggingface.co/api/models?search={keyword}"
            response = requests.get(url)

            if response.status_code != 200:
                return jsonify({'error': 'Erreur de connexion à HuggingFace'}), 500

            data = response.json()
            filtered_models = []

            for model in data:
                if not model.get('tags', []):
                    continue

                if 'gguf' not in model.get('tags', []):
                    continue

                model_id = model['id'].lower()
                if all(word in model_id for word in words):
                    filtered_models.append({
                        'name': f"hf.co/{model['id']}",
                        'created_at': model.get('createdAt'),
                        'tags': model.get('tags', [])
                    })

            return jsonify({'models': filtered_models})

        else:  # source == 'ollama'
            # Get models from Ollama library using BeautifulSoup
            response = requests.get('https://ollama.com/library')
            if response.status_code != 200:
                return jsonify({'error': 'Erreur de connexion à la bibliothèque Ollama'}), 500

            soup = BeautifulSoup(response.content, 'html.parser')
            model_items = soup.find_all('li', attrs={'x-test-model': True})

            result = []
            filter_tags = ['embedding', 'tools', 'vision']

            for item in model_items:
                name_span = item.select_one('span.group-hover\\:underline')
                name = name_span.get_text(strip=True) if name_span else None

                if not name:
                    continue

                capability_spans = item.find_all('span', attrs={'x-test-capability': True})
                size_spans = item.find_all('span', attrs={'x-test-size': True})
                tags = [span.get_text(strip=True) for span in capability_spans + size_spans]
                tags_lower = [tag.lower() for tag in tags]

                # Filtrer selon les filtres sélectionnés
                if not selected_filters or any(f.lower() in tags_lower for f in selected_filters):
                    # Pour chaque tag qui n'est pas un filtre prédéfini
                    for tag in tags:
                        if tag.lower() not in [ft.lower() for ft in filter_tags]:
                            # Si le mot-clé est présent dans la combinaison model:tag
                            if not keyword or keyword.lower() in f"{name}:{tag}".lower():
                                result.append(f"{name}:{tag}")

            return jsonify({'models': result})

    except Exception as e:
        print(f"Error searching models: {str(e)}")
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
            'error': result.get('error', t('error_saving')),
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