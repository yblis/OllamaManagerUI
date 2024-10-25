from flask import Flask, render_template, jsonify, request
from ollama_client import OllamaClient
import traceback

app = Flask(__name__)
ollama_client = OllamaClient()

@app.route('/')
def index():
    server_status = ollama_client.check_server()
    return render_template('index.html', server_status=server_status)

@app.route('/api/server/status')
def server_status():
    try:
        status = ollama_client.check_server()
        return jsonify({'status': 'running' if status else 'stopped'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/models', methods=['GET'])
def get_models():
    try:
        if not ollama_client.check_server():
            return jsonify({'error': 'Ollama server is not running. Please start the server and try again.'}), 503
        models = ollama_client.list_models()
        return jsonify(models)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/running', methods=['GET'])
def get_running_models():
    try:
        if not ollama_client.check_server():
            return jsonify({'error': 'Ollama server is not running. Please start the server and try again.'}), 503
        models = ollama_client.list_running()
        return jsonify(models)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/pull', methods=['POST'])
def pull_model():
    try:
        if not ollama_client.check_server():
            return jsonify({'error': 'Ollama server is not running. Please start the server and try again.'}), 503
        
        model_name = request.json.get('name')
        if not model_name:
            return jsonify({'error': 'Model name is required'}), 400
        
        result = ollama_client.pull_model(model_name)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/delete', methods=['POST'])
def delete_model():
    try:
        if not ollama_client.check_server():
            return jsonify({'error': 'Ollama server is not running. Please start the server and try again.'}), 503
        
        model_name = request.json.get('name')
        if not model_name:
            return jsonify({'error': 'Model name is required'}), 400
        
        result = ollama_client.delete_model(model_name)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.errorhandler(Exception)
def handle_error(error):
    print(traceback.format_exc())
    return jsonify({'error': str(error)}), 500
