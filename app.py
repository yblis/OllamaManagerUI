from flask import Flask, render_template, jsonify, request
from ollama_client import OllamaClient
import traceback
import requests
from functools import wraps
import time
from bs4 import BeautifulSoup

app = Flask(__name__)
ollama_client = OllamaClient()

def with_error_handling(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            if not ollama_client.check_server():
                return jsonify({
                    'error': 'Ollama server is not running. Please ensure Ollama is installed and running.',
                    'status': 'server_stopped'
                }), 503
            return f(*args, **kwargs)
        except requests.exceptions.ConnectionError:
            return jsonify({
                'error': 'Unable to connect to Ollama server. Please ensure Ollama is installed and running.',
                'status': 'connection_error'
            }), 503
        except Exception as e:
            print(traceback.format_exc())
            return jsonify({
                'error': str(e),
                'status': 'error'
            }), 500
    return decorated_function

@app.before_request
def before_request():
    global ollama_client
    base_url = request.headers.get('X-Ollama-URL')
    if base_url:
        ollama_client = OllamaClient(base_url=base_url)

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/')
def index():
    server_status = ollama_client.check_server()
    return render_template('index.html', server_status=server_status)

@app.route('/api/server/status')
@with_error_handling
def server_status():
    status = ollama_client.check_server()
    return jsonify({'status': 'running' if status else 'stopped'})

@app.route('/api/models', methods=['GET'])
@with_error_handling
def get_models():
    models = ollama_client.list_models()
    return jsonify({'models': models})

@app.route('/api/models/search', methods=['POST'])
@with_error_handling
def search_models():
    keyword = request.json.get('keyword', '')
    url = "https://ollama.com/library/"
    try:
        response = requests.get(url)
        if response.status_code != 200:
            return jsonify({'error': 'Erreur de connexion à la bibliothèque Ollama'}), 500
        
        soup = BeautifulSoup(response.text, 'html.parser')
        models = []
        for model in soup.find_all('a', class_='model-link'):
            model_name = model.text.strip()
            if keyword.lower() in model_name.lower():
                models.append(model_name)
        
        return jsonify({'models': models})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/running', methods=['GET'])
@with_error_handling
def get_running_models():
    response = ollama_client.list_running()
    return jsonify(response)

@app.route('/api/models/<model_name>/config', methods=['GET'])
@with_error_handling
def get_model_config(model_name):
    return jsonify(ollama_client.get_model_config(model_name))

@app.route('/api/models/<model_name>/stats', methods=['GET'])
@with_error_handling
def get_model_stats(model_name):
    return jsonify(ollama_client.get_model_stats(model_name))

@app.route('/api/models/stats', methods=['GET'])
@with_error_handling
def get_all_model_stats():
    stats = ollama_client.get_model_stats()
    return jsonify(stats)

@app.route('/api/models/stop', methods=['POST'])
@with_error_handling
def stop_model():
    model_name = request.json.get('name')
    if not model_name:
        return jsonify({
            'error': 'Model name is required',
            'status': 'validation_error'
        }), 400
    
    try:
        result = ollama_client.stop_model(model_name)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@app.route('/api/models/delete', methods=['POST'])
@with_error_handling
def delete_model():
    model_name = request.json.get('name')
    if not model_name:
        return jsonify({
            'error': 'Model name is required',
            'status': 'validation_error'
        }), 400
        
    result = ollama_client.delete_model(model_name)
    return jsonify(result)

@app.errorhandler(Exception)
def handle_error(error):
    print(traceback.format_exc())
    return jsonify({
        'error': str(error),
        'status': 'error'
    }), 500
