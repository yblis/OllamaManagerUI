import requests
from requests.exceptions import ConnectionError, RequestException

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

    def list_models(self):
        """Get list of locally available models"""
        return self._handle_request(requests.get, '/api/tags')

    def list_running(self):
        """Get list of currently loaded models by sending an empty prompt to check"""
        try:
            models = self._handle_request(requests.get, '/api/tags')
            running_models = []
            
            # For each model, send an empty prompt to check if it's loaded
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
        self._handle_request(requests.post, '/api/pull', json={'name': model_name})
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
