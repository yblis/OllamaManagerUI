from flask import Flask, render_template, jsonify, request
from ollama_client import OllamaClient
import traceback
import requests
from functools import wraps
import time

app = Flask(__name__)
ollama_client = OllamaClient()

def with_error_handling(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
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
    if not ollama_client.check_server():
        return jsonify({
            'error': 'Ollama server is not running. Please start the server and try again.',
            'status': 'server_stopped'
        }), 503
    models = ollama_client.list_models()
    return jsonify({'models': models})

@app.route('/api/models/running', methods=['GET'])
@with_error_handling
def get_running_models():
    if not ollama_client.check_server():
        return jsonify({
            'error': 'Ollama server is not running. Please start the server and try again.',
            'status': 'server_stopped'
        }), 503
    response = ollama_client.list_running()
    return jsonify(response)

@app.route('/api/models/stats', methods=['GET'])
@with_error_handling
def get_model_stats():
    if not ollama_client.check_server():
        return jsonify({
            'error': 'Ollama server is not running. Please start the server and try again.',
            'status': 'server_stopped'
        }), 503
    
    stats = ollama_client.get_model_stats()
    return jsonify(stats)

@app.route('/api/models/stop', methods=['POST'])
@with_error_handling
def stop_model():
    if not ollama_client.check_server():
        return jsonify({
            'error': 'Ollama server is not running. Please start the server and try again.',
            'status': 'server_stopped'
        }), 503
    
    model_name = request.json.get('name')
    if not model_name:
        return jsonify({
            'error': 'Model name is required',
            'status': 'validation_error'
        }), 400
    
    max_retries = 3
    retry_delay = 1  # seconds
    
    for attempt in range(max_retries):
        try:
            response = requests.post('http://localhost:11434/api/generate', json={
                'model': model_name,
                'prompt': '',
                'keep_alive': 0
            })
            response.raise_for_status()
            return jsonify({
                'success': True,
                'message': f'Successfully stopped model {model_name}'
            })
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(retry_delay)
    
    return jsonify({
        'error': 'Failed to stop model after multiple attempts',
        'status': 'error'
    }), 500

@app.errorhandler(Exception)
def handle_error(error):
    print(traceback.format_exc())
    return jsonify({
        'error': str(error),
        'status': 'error'
    }), 500
