"""
WSGI Entry Point for cPanel Passenger
"""
import sys
import os

# Add application directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Import Flask application
from app import create_app

# Create application instance
application = create_app('production')
