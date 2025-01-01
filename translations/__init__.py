"""Translation manager for the Ollama Manager UI"""
import os
from flask import request, session

# Import language files
from .en import translations as en_translations
from .fr import translations as fr_translations

TRANSLATIONS = {
    'en': en_translations,
    'fr': fr_translations
}

DEFAULT_LANGUAGE = 'fr'

def get_translation(key, **kwargs):
    """Get translated text for the given key in the current language"""
    current_lang = session.get('language', DEFAULT_LANGUAGE)
    translations = TRANSLATIONS.get(current_lang, TRANSLATIONS[DEFAULT_LANGUAGE])
    text = translations.get(key, TRANSLATIONS[DEFAULT_LANGUAGE].get(key, key))
    
    # Apply any format parameters
    if kwargs:
        try:
            text = text.format(**kwargs)
        except KeyError:
            # If formatting fails, return the unformatted text
            pass
    
    return text

def get_available_languages():
    """Get list of available languages"""
    return list(TRANSLATIONS.keys())

def set_language(lang):
    """Set the current language"""
    if lang in TRANSLATIONS:
        session['language'] = lang
        return True
    return False

# Jinja2 template function
def t(key, **kwargs):
    """Template function for translations"""
    return get_translation(key, **kwargs)
