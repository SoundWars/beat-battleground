"""
SoundWars Flask API - Main Application
"""
import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_app(config_name=None):
    """Application factory pattern"""
    app = Flask(__name__)
    
    # Load configuration
    from config import config
    config_name = config_name or os.environ.get('FLASK_ENV', 'development')
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    from models import db
    db.init_app(app)
    
    # Initialize JWT
    jwt = JWTManager(app)
    
    # Initialize Flask-Mail
    from utils.email import mail
    mail.init_app(app)
    
    # Configure CORS
    CORS(app, origins=[
        app.config['FRONTEND_URL'],
        'http://localhost:5173',
        'http://localhost:3000'
    ], supports_credentials=True)
    
    # Initialize rate limiter
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=["200 per day", "50 per hour"]
    )
    
    # Register blueprints
    from routes.auth import auth_bp
    from routes.artists import artists_bp
    from routes.songs import songs_bp
    from routes.votes import votes_bp
    from routes.payments import payments_bp
    from routes.leaderboard import leaderboard_bp
    from routes.admin import admin_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(artists_bp)
    app.register_blueprint(songs_bp)
    app.register_blueprint(votes_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(leaderboard_bp)
    app.register_blueprint(admin_bp)
    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return {'status': 'healthy', 'version': '1.0.0'}
    
    # Create tables on first request (development only)
    with app.app_context():
        db.create_all()
    
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
