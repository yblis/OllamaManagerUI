import requests
from requests.exceptions import ConnectionError, RequestException
from models import ModelUsage

class OllamaClient:
    def __init__(self, base_url='http://localhost:11434'):
        self.base_url = base_url

    def _handle_request(self, method, endpoint, **kwargs):
        """Generic method to handle requests and provide meaningful error messages"""
        try:
            response = method(f'{self.base_url}{endpoint}', **kwargs)
            response.raise_for_status()
            return response.json()
        except ConnectionError:
            raise Exception("Unable to connect to Ollama server. Please ensure Ollama is installed and running on port 11434.")
        except RequestException as e:
            raise Exception(f"Error communicating with Ollama server: {str(e)}")

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

    def list_models(self):
        """Get list of locally available models"""
        return self._handle_request(requests.get, '/api/tags')

    def list_running(self):
        """Get list of currently loaded models by sending an empty prompt to check"""
        try:
            models = self._handle_request(requests.get, '/api/tags')
            running_models = []
            
            for model in models.get('models', []):
                try:
                    response = requests.post(f'{self.base_url}/api/generate', 
                                          json={'model': model['name'], 'prompt': ''}, 
                                          timeout=1)
                    if response.status_code == 200:
                        running_models.append(model)
                except:
                    continue
                    
            return {'models': running_models}
        except Exception as e:
            raise Exception(f"Error checking running models: {str(e)}")

    def pull_model(self, model_name):
        """Pull a model from the registry"""
        response = self._handle_request(requests.post, '/api/pull', json={'name': model_name})
        self._log_usage(model_name, 'pull', response)
        return {'success': True, 'message': f'Successfully pulled model {model_name}'}

    def delete_model(self, model_name):
        """Delete a model"""
        self._handle_request(requests.delete, '/api/delete', json={'name': model_name})
        return {'success': True, 'message': f'Successfully deleted model {model_name}'}

    def check_server(self):
        """Check if Ollama server is running"""
        try:
            requests.get(f'{self.base_url}/api/tags', timeout=2)
            return True
        except:
            return False

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
        """Update model configuration by creating a new model version"""
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
