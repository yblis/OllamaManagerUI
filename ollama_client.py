import requests
from requests.exceptions import ConnectionError, RequestException, Timeout
from models import ModelUsage
import time
import os
import json

class OllamaClient:
    def __init__(self, base_url=None):
        self.base_url = base_url or os.environ.get('OLLAMA_SERVER_URL', 'http://localhost:11434')
        self.api_key = os.environ.get('OLLAMA_API_KEY')
        self.max_retries = 3
        self.retry_delay = 1  # Initial delay in seconds
        self._server_status = None
        self._last_check = 0
        self._check_interval = 5  # Check server every 5 seconds

    def _get_headers(self):
        headers = {'Content-Type': 'application/json'}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        return headers

    def _handle_request(self, method, endpoint, **kwargs):
        """Generic method to handle requests with retry mechanism"""
        if not self.check_server():
            raise Exception("Ollama server is not running. Please start the server and try again.")

        retries = 0
        last_error = None
        current_delay = self.retry_delay

        while retries < self.max_retries:
            try:
                kwargs['timeout'] = kwargs.get('timeout', 5)
                kwargs['headers'] = {**self._get_headers(), **kwargs.get('headers', {})}
                response = method(f'{self.base_url}{endpoint}', **kwargs)
                response.raise_for_status()
                return response.json()
            except ConnectionError:
                last_error = "Unable to connect to Ollama server"
            except Timeout:
                last_error = "Connection to Ollama server timed out"
            except RequestException as e:
                if e.response is not None and e.response.status_code == 503:
                    last_error = "Ollama server is not running"
                else:
                    last_error = f"Server error: {str(e)}"

            retries += 1
            if retries < self.max_retries:
                time.sleep(current_delay)
                current_delay *= 2  # Exponential backoff

        raise Exception(f"{last_error}. Please ensure Ollama is installed and running.")

    def _log_usage(self, model_name, operation, response_data):
        """Log model usage statistics"""
        prompt_tokens = response_data.get('prompt_eval_count', 0)
        completion_tokens = response_data.get('eval_count', 0)
        total_duration = response_data.get('total_duration', 0) / 1e9  # Convert nanoseconds to seconds
        
        ModelUsage.log_usage(
            model_name=model_name,
            operation=operation,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_duration=total_duration
        )

    def check_server(self):
        """Check if Ollama server is running with caching"""
        current_time = time.time()
        if self._server_status is not None and (current_time - self._last_check) < self._check_interval:
            return self._server_status

        try:
            response = requests.get(f'{self.base_url}/api/tags', headers=self._get_headers(), timeout=2)
            self._server_status = response.status_code == 200
        except (ConnectionError, Timeout, RequestException):
            self._server_status = False

        self._last_check = current_time
        return self._server_status

    def list_models(self):
        try:
            response = self._handle_request(requests.get, '/api/tags')
            return response.get('models', [])
        except Exception as e:
            print(f"Error listing models: {str(e)}")
            return []

    def list_running(self):
        try:
            response = self._handle_request(requests.get, '/api/ps')
            return {'models': response.get('models', [])}
        except Exception as e:
            print(f"Error checking running models: {str(e)}")
            return {'models': []}

    def pull_model(self, model_name):
        try:
            url = f'{self.base_url}/api/pull'
            response = requests.post(url, 
                headers=self._get_headers(),
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
                    
            return {'success': True, 'message': f'Successfully pulled model {model_name}'}
        except requests.exceptions.RequestException as e:
            raise Exception(f"Error pulling model: {str(e)}")

    def delete_model(self, model_name):
        self._handle_request(requests.post, '/api/delete', 
            json={'name': model_name})
        return {'success': True, 'message': f'Successfully deleted model {model_name}'}

    def stop_model(self, model_name):
        self._handle_request(requests.post, '/api/generate', 
            json={'model': model_name, 'prompt': '', 'keep_alive': 0})
        return {'success': True, 'message': f'Successfully stopped model {model_name}'}

    def get_model_stats(self, model_name=None):
        """Get usage statistics for a specific model or all models"""
        return ModelUsage.get_model_stats(model_name)

    def get_model_config(self, model_name):
        """Get model configuration details"""
        try:
            response = self._handle_request(requests.post, '/api/show', json={'name': model_name})
            return {
                'modelfile': response.get('modelfile', ''),
                'parameters': self._extract_parameters(response.get('modelfile', '')),
                'template': self._extract_template(response.get('modelfile', '')),
                'system': self._extract_system(response.get('modelfile', ''))
            }
        except Exception as e:
            raise Exception(f"Error getting model configuration: {str(e)}")

    def update_model_config(self, model_name, config):
        """Update model configuration"""
        try:
            modelfile = self._generate_modelfile(model_name, config)
            response = self._handle_request(requests.post, '/api/create', json={
                'name': model_name,
                'modelfile': modelfile
            })
            return {'success': True, 'message': f'Successfully updated model configuration for {model_name}'}
        except Exception as e:
            raise Exception(f"Error updating model configuration: {str(e)}")

    def _extract_parameters(self, modelfile):
        """Extract parameters from modelfile"""
        parameters = {}
        for line in modelfile.split('\n'):
            if line.startswith('PARAMETER'):
                parts = line.split(' ', 2)
                if len(parts) >= 3:
                    key = parts[1]
                    value = parts[2].strip('"')
                    parameters[key] = value
        return parameters

    def _extract_template(self, modelfile):
        """Extract template from modelfile"""
        start = modelfile.find('TEMPLATE')
        if start == -1:
            return ""
        
        template_line = modelfile[start:].split('\n')[0]
        template = template_line.split('"')[1] if '"' in template_line else ""
        return template

    def _extract_system(self, modelfile):
        """Extract system prompt from modelfile"""
        start = modelfile.find('SYSTEM')
        if start == -1:
            return ""
        
        system_line = modelfile[start:].split('\n')[0]
        system = system_line.split('SYSTEM', 1)[1].strip()
        return system

    def _generate_modelfile(self, model_name, config):
        """Generate modelfile content from configuration"""
        lines = [f"FROM {model_name}"]
        
        if config.get('system'):
            lines.append(f'SYSTEM {config["system"]}')
        
        if config.get('template'):
            lines.append(f'TEMPLATE "{config["template"]}"')
        
        for key, value in config.get('parameters', {}).items():
            lines.append(f'PARAMETER {key} {value}')
        
        return '\n'.join(lines)
