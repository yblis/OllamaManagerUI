from flask import Flask, render_template, jsonify, request
from ollama_client import OllamaClient
import traceback

app = Flask(__name__)
ollama_client = OllamaClient()

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
        return jsonify({'models': models})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/running', methods=['GET'])
def get_running_models():
    try:
        if not ollama_client.check_server():
            return jsonify({'error': 'Ollama server is not running. Please start the server and try again.'}), 503
        response = ollama_client.list_running()
        return jsonify(response)
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

@app.route('/api/models/batch/delete', methods=['POST'])
def batch_delete_models():
    try:
        if not ollama_client.check_server():
            return jsonify({'error': 'Ollama server is not running. Please start the server and try again.'}), 503
        
        model_names = request.json.get('names', [])
        if not model_names:
            return jsonify({'error': 'At least one model name is required'}), 400
        
        results = []
        for name in model_names:
            try:
                result = ollama_client.delete_model(name)
                results.append({'name': name, 'success': True, 'message': result.get('message', 'Success')})
            except Exception as e:
                results.append({'name': name, 'success': False, 'message': str(e)})
        
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/batch/update_config', methods=['POST'])
def batch_update_config():
    try:
        if not ollama_client.check_server():
            return jsonify({'error': 'Ollama server is not running. Please start the server and try again.'}), 503
        
        data = request.json
        if not data or 'models' not in data or 'config' not in data:
            return jsonify({'error': 'Model names and configuration are required'}), 400
        
        model_names = data['models']
        config = data['config']
        
        results = []
        for name in model_names:
            try:
                result = ollama_client.update_model_config(name, config)
                results.append({'name': name, 'success': True, 'message': result.get('message', 'Success')})
            except Exception as e:
                results.append({'name': name, 'success': False, 'message': str(e)})
        
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/stats', methods=['GET'])
def get_model_stats():
    try:
        model_name = request.args.get('name')
        stats = ollama_client.get_model_stats(model_name)
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/config', methods=['GET'])
def get_model_config():
    try:
        if not ollama_client.check_server():
            return jsonify({'error': 'Ollama server is not running. Please start the server and try again.'}), 503
        
        model_name = request.args.get('name')
        if not model_name:
            return jsonify({'error': 'Model name is required'}), 400
        
        config = ollama_client.get_model_config(model_name)
        return jsonify(config)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/config', methods=['POST'])
def update_model_config():
    try:
        if not ollama_client.check_server():
            return jsonify({'error': 'Ollama server is not running. Please start the server and try again.'}), 503
        
        data = request.json
        if not data or 'name' not in data or 'config' not in data:
            return jsonify({'error': 'Model name and configuration are required'}), 400
        
        result = ollama_client.update_model_config(data['name'], data['config'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/compare', methods=['POST'])
def compare_models():
    try:
        if not ollama_client.check_server():
            return jsonify({'error': 'Ollama server is not running. Please start the server and try again.'}), 503
        
        model_names = request.json.get('models', [])
        if not model_names or len(model_names) < 2:
            return jsonify({'error': 'At least two model names are required for comparison'}), 400
        
        comparison_data = []
        for name in model_names:
            try:
                config = ollama_client.get_model_config(name)
                stats = ollama_client.get_model_stats(name)
                model_info = next((m for m in ollama_client.list_models() if m['name'] == name), {})
                
                comparison_data.append({
                    'name': name,
                    'config': config,
                    'stats': stats,
                    'details': model_info.get('details', {}),
                    'size': model_info.get('size', 0)
                })
            except Exception as e:
                return jsonify({'error': f'Error getting data for model {name}: {str(e)}'}), 500
        
        return jsonify({'comparison': comparison_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.errorhandler(Exception)
def handle_error(error):
    print(traceback.format_exc())
    return jsonify({'error': str(error)}), 500
