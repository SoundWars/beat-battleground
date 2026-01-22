# SoundWars Flask API - cPanel Deployment Guide

## Overview
This guide covers deploying the SoundWars Flask backend API on cPanel shared hosting.

## Prerequisites
- cPanel hosting with Python support (Python 3.9+)
- MySQL database access
- SSH access (recommended) or File Manager
- SSL certificate configured

## Directory Structure

```
/home/yourusername/
├── public_html/
│   └── api/                    # API subdomain or subfolder
│       └── .htaccess           # Apache configuration
├── soundwars_backend/          # Application files (outside public_html)
│   ├── app.py                  # Main Flask application
│   ├── config.py               # Configuration
│   ├── requirements.txt        # Python dependencies
│   ├── passenger_wsgi.py       # Passenger WSGI entry point
│   ├── .env                    # Environment variables
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── artist.py
│   │   ├── song.py
│   │   ├── vote.py
│   │   ├── contest.py
│   │   └── payment.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── artists.py
│   │   ├── songs.py
│   │   ├── votes.py
│   │   ├── payments.py
│   │   ├── leaderboard.py
│   │   └── admin.py
│   └── utils/
│       ├── __init__.py
│       ├── security.py
│       ├── email.py
│       └── validators.py
└── logs/
    └── soundwars_error.log
```

## Step 1: Create Python Application in cPanel

1. Log into cPanel
2. Go to **Setup Python App**
3. Click **Create Application**
4. Configure:
   - Python version: **3.9** or higher
   - Application root: `soundwars_backend`
   - Application URL: `api.yourdomain.com` or `yourdomain.com/api`
   - Application startup file: `passenger_wsgi.py`
   - Application Entry point: `application`
5. Click **Create**

## Step 2: Configuration Files

### passenger_wsgi.py
```python
import sys
import os

# Add application directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Import Flask application
from app import create_app

application = create_app()
```

### config.py
```python
import os
from datetime import timedelta

class Config:
    # Security
    SECRET_KEY = os.environ.get('SECRET_KEY') or os.urandom(32)
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or os.urandom(32)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # Database - MySQL for cPanel
    DB_USER = os.environ.get('DB_USER')
    DB_PASSWORD = os.environ.get('DB_PASSWORD')
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_NAME = os.environ.get('DB_NAME')
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Flutterwave
    FLUTTERWAVE_SECRET_KEY = os.environ.get('FLUTTERWAVE_SECRET_KEY')
    FLUTTERWAVE_PUBLIC_KEY = os.environ.get('FLUTTERWAVE_PUBLIC_KEY')
    FLUTTERWAVE_ENCRYPTION_KEY = os.environ.get('FLUTTERWAVE_ENCRYPTION_KEY')
    
    # Email - cPanel SMTP
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'localhost')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 465))
    MAIL_USE_SSL = True
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')
    
    # Frontend URL for CORS and email links
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://yourdomain.com')
    
    # File uploads
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', '/home/yourusername/soundwars_uploads')
    MAX_CONTENT_LENGTH = 15 * 1024 * 1024  # 15MB

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
```

### .env (Environment Variables)
```bash
# Flask
FLASK_ENV=production
SECRET_KEY=your-super-secret-key-here-min-32-chars
JWT_SECRET_KEY=another-super-secret-key-for-jwt

# Database (cPanel MySQL)
DB_HOST=localhost
DB_USER=yourusername_dbuser
DB_PASSWORD=your_db_password
DB_NAME=yourusername_soundwars

# Flutterwave
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxxxxxx
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxxxxxxxxx
FLUTTERWAVE_ENCRYPTION_KEY=xxxxxxxxxx

# Email (cPanel SMTP)
MAIL_SERVER=mail.yourdomain.com
MAIL_PORT=465
MAIL_USERNAME=noreply@yourdomain.com
MAIL_PASSWORD=your_email_password
MAIL_DEFAULT_SENDER=SoundWars <noreply@yourdomain.com>

# Frontend
FRONTEND_URL=https://yourdomain.com
```

### requirements.txt
```
Flask==3.0.0
Flask-SQLAlchemy==3.1.1
Flask-JWT-Extended==4.6.0
Flask-CORS==4.0.0
Flask-Mail==0.9.1
Flask-Limiter==3.5.0
PyMySQL==1.1.0
cryptography==41.0.7
python-dotenv==1.0.0
Werkzeug==3.0.1
bcrypt==4.1.2
requests==2.31.0
bleach==6.1.0
email-validator==2.1.0
```

### .htaccess (in public_html/api/)
```apache
RewriteEngine On

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Security Headers
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "DENY"
Header always set X-XSS-Protection "1; mode=block"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Content-Security-Policy "default-src 'self'"

# Block sensitive files
<FilesMatch "\.(env|py|pyc|log|ini|cfg)$">
    Order allow,deny
    Deny from all
</FilesMatch>
```

## Step 3: Authentication Routes with Password Reset

### routes/auth.py
```python
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token, 
    jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User
from utils.security import sanitize_input, validate_email, validate_password
from utils.email import send_password_reset_email
import secrets
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# Rate limiting
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per hour")
def register():
    data = request.get_json()
    
    # Sanitize inputs
    email = sanitize_input(data.get('email', '')).lower()
    username = sanitize_input(data.get('username', ''))
    password = data.get('password', '')
    role = sanitize_input(data.get('role', 'user'))
    
    # Validation
    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400
    
    password_valid, password_msg = validate_password(password)
    if not password_valid:
        return jsonify({'error': password_msg}), 400
    
    # Check existing user
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409
    
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 409
    
    # Create user
    user = User(
        email=email,
        username=username,
        password_hash=generate_password_hash(password),
        roles=[role]
    )
    
    db.session.add(user)
    db.session.commit()
    
    # Generate tokens
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    response = {
        'message': 'Registration successful',
        'token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
        'requires_payment': role == 'artist'
    }
    
    return jsonify(response), 201

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    data = request.get_json()
    
    email = sanitize_input(data.get('email', '')).lower()
    password = data.get('password', '')
    
    user = User.query.filter_by(email=email).first()
    
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    return jsonify({
        'token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict()
    }), 200

@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit("3 per hour")
def forgot_password():
    data = request.get_json()
    email = sanitize_input(data.get('email', '')).lower()
    
    # Always return success to prevent email enumeration
    user = User.query.filter_by(email=email).first()
    
    if user:
        # Generate secure reset token
        reset_token = secrets.token_urlsafe(32)
        user.reset_token = reset_token
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        db.session.commit()
        
        # Send reset email
        reset_url = f"{current_app.config['FRONTEND_URL']}/reset-password?token={reset_token}"
        send_password_reset_email(user.email, user.username, reset_url)
    
    return jsonify({'message': 'If an account exists, reset instructions have been sent'}), 200

@auth_bp.route('/verify-reset-token', methods=['POST'])
@limiter.limit("10 per minute")
def verify_reset_token():
    data = request.get_json()
    token = data.get('token', '')
    
    user = User.query.filter_by(reset_token=token).first()
    
    if not user or not user.reset_token_expires:
        return jsonify({'error': 'Invalid or expired token'}), 400
    
    if datetime.utcnow() > user.reset_token_expires:
        user.reset_token = None
        user.reset_token_expires = None
        db.session.commit()
        return jsonify({'error': 'Token has expired'}), 400
    
    return jsonify({'valid': True}), 200

@auth_bp.route('/reset-password', methods=['POST'])
@limiter.limit("5 per hour")
def reset_password():
    data = request.get_json()
    token = data.get('token', '')
    new_password = data.get('password', '')
    
    # Validate password
    password_valid, password_msg = validate_password(new_password)
    if not password_valid:
        return jsonify({'error': password_msg}), 400
    
    user = User.query.filter_by(reset_token=token).first()
    
    if not user or not user.reset_token_expires:
        return jsonify({'error': 'Invalid or expired token'}), 400
    
    if datetime.utcnow() > user.reset_token_expires:
        user.reset_token = None
        user.reset_token_expires = None
        db.session.commit()
        return jsonify({'error': 'Token has expired'}), 400
    
    # Update password
    user.password_hash = generate_password_hash(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.session.commit()
    
    return jsonify({'message': 'Password reset successful'}), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'user': user.to_dict()}), 200
```

### utils/email.py
```python
from flask import current_app
from flask_mail import Message, Mail

mail = Mail()

def send_password_reset_email(to_email, username, reset_url):
    """Send password reset email using cPanel SMTP"""
    try:
        msg = Message(
            subject="Reset Your SoundWars Password",
            sender=current_app.config['MAIL_DEFAULT_SENDER'],
            recipients=[to_email]
        )
        
        msg.html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #00c9a7, #00b4d8); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .header h1 {{ color: #fff; margin: 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: #00c9a7; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎵 SoundWars</h1>
                </div>
                <div class="content">
                    <h2>Password Reset Request</h2>
                    <p>Hi {username},</p>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <p style="text-align: center;">
                        <a href="{reset_url}" class="button">Reset Password</a>
                    </p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this, you can safely ignore this email.</p>
                    <p>Best,<br>The SoundWars Team</p>
                </div>
                <div class="footer">
                    <p>© 2024 SoundWars. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send email: {e}")
        return False
```

### utils/security.py
```python
import re
import bleach

def sanitize_input(value: str) -> str:
    """Sanitize user input to prevent XSS and injection attacks"""
    if not isinstance(value, str):
        return ''
    
    # Remove HTML tags
    cleaned = bleach.clean(value, tags=[], strip=True)
    
    # Limit length
    cleaned = cleaned[:1000]
    
    return cleaned.strip()

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_password(password: str) -> tuple[bool, str]:
    """Validate password strength"""
    if len(password) < 8:
        return False, 'Password must be at least 8 characters'
    if not re.search(r'[A-Z]', password):
        return False, 'Password must contain an uppercase letter'
    if not re.search(r'[a-z]', password):
        return False, 'Password must contain a lowercase letter'
    if not re.search(r'[0-9]', password):
        return False, 'Password must contain a number'
    if not re.search(r'[!@#$%^&*]', password):
        return False, 'Password must contain a special character (!@#$%^&*)'
    
    return True, 'Valid'

def validate_transaction_ref(ref: str) -> bool:
    """Validate Flutterwave transaction reference"""
    pattern = r'^[a-zA-Z0-9_-]+$'
    return bool(re.match(pattern, ref)) and 10 <= len(ref) <= 100
```

## Step 4: Database Migration

```python
# Create database tables via Python shell
# SSH into server, activate virtual environment:
source /home/yourusername/virtualenv/soundwars_backend/3.9/bin/activate
cd /home/yourusername/soundwars_backend
python

>>> from app import create_app
>>> from models import db
>>> app = create_app()
>>> with app.app_context():
...     db.create_all()
```

## Step 5: cPanel Cron Jobs

Set up cron jobs in cPanel for:

```bash
# Clean expired reset tokens (run daily)
0 2 * * * cd /home/yourusername/soundwars_backend && /home/yourusername/virtualenv/soundwars_backend/3.9/bin/python -c "from cleanup import clean_expired_tokens; clean_expired_tokens()"

# Process contest winners (run monthly)
0 0 1 * * cd /home/yourusername/soundwars_backend && /home/yourusername/virtualenv/soundwars_backend/3.9/bin/python -c "from tasks import process_contest_winners; process_contest_winners()"
```

## Security Checklist

- [x] HTTPS enforced via .htaccess
- [x] Environment variables stored in .env (not in code)
- [x] Password hashing with bcrypt
- [x] JWT token expiration
- [x] Rate limiting on auth endpoints
- [x] Input sanitization with bleach
- [x] SQL injection prevention via SQLAlchemy ORM
- [x] XSS prevention via input sanitization
- [x] CORS properly configured
- [x] Security headers in .htaccess
- [x] Sensitive files blocked from web access
- [x] Password reset tokens expire after 1 hour
- [x] No email enumeration on forgot password

## Troubleshooting

### Application Not Starting
1. Check Python version in cPanel
2. Verify `passenger_wsgi.py` syntax
3. Check error logs: `/home/yourusername/logs/soundwars_error.log`

### Database Connection Issues
1. Verify MySQL user has proper permissions
2. Check database name matches cPanel prefix
3. Test connection via Python shell

### Email Not Sending
1. Verify cPanel email account exists
2. Check SMTP credentials in .env
3. Test with cPanel webmail first
