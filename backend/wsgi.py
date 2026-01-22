"""
WSGI Entry Point for Gunicorn (AWS/Production)
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app import create_app

# Create application instance
app = create_app(os.environ.get('FLASK_ENV', 'production'))

if __name__ == '__main__':
    app.run()
