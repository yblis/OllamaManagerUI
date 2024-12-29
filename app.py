from flask import Flask, render_template, jsonify, request, Response
from ollama_client import OllamaClient
import traceback
import requests
from functools import wraps
import time
import subprocess
import re
import os
import json

app = Flask(__name__)
ollama_client = OllamaClient()

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
    base_url = request.headers.get('X-Ollama-URL') or os.environ.get('OLLAMA_SERVER_URL')
    if base_url:
        print(f"Using Ollama server URL: {base_url}")
        ollama_client = OllamaClient(base_url=base_url)
    else:
        print("Warning: No Ollama server URL provided")

@app.route('/')
def index():
    return render_template('index.html', server_status=False)

@app.route('/api/models/pull', methods=['POST'])
@with_error_handling
def pull_model():
    model_name = request.json.get('name')
    if not model_name:
        return jsonify({
            'error': 'Le nom du modèle est requis',
            'status': 'validation_error'
        }), 400

    def generate_progress():
        try:
            url = f'{ollama_client.base_url}/api/pull'
            response = requests.post(
                url, 
                headers=ollama_client._get_headers(),
                json={'name': model_name},
                stream=True
            )

            response.raise_for_status()
            total_size = None
            current_size = 0

            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line)

                        # Si nous avons un statut de progression
                        if 'total' in data and 'completed' in data:
                            total_size = data['total']
                            current_size = data['completed']
                            progress = (current_size / total_size) * 100 if total_size else 0

                            yield json.dumps({
                                'status': 'downloading',
                                'progress': progress,
                                'current': current_size,
                                'total': total_size
                            }) + '\n'

                        # Si nous avons un message de succès
                        elif data.get('status') == 'success':
                            yield json.dumps({
                                'status': 'success',
                                'message': f'Successfully pulled model {model_name}'
                            }) + '\n'
                            break

                    except json.JSONDecodeError:
                        continue

        except requests.exceptions.RequestException as e:
            yield json.dumps({
                'status': 'error',
                'error': str(e)
            }) + '\n'

    return Response(generate_progress(), mimetype='text/event-stream')

@app.route('/api/server/url')
def get_server_url():
    """Get the Ollama server URL from environment"""
    url = os.environ.get('OLLAMA_SERVER_URL')
    return jsonify({'url': url}) if url else jsonify({'error': 'No server URL configured'}), 404

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