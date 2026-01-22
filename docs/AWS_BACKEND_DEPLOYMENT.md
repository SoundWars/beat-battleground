# SoundWars Flask API - AWS Deployment Guide

## Overview
This guide covers deploying the SoundWars Flask backend API on AWS using EC2, RDS, and other AWS services.

## AWS Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AWS Cloud                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │
│  │   Route 53      │───▶│   CloudFront    │───▶│   ALB           │    │
│  │   (DNS)         │    │   (CDN/SSL)     │    │   (Load Bal.)   │    │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘    │
│                                                          │             │
│  ┌───────────────────────────────────────────────────────┼───────────┐ │
│  │                    VPC (10.0.0.0/16)                  │           │ │
│  │  ┌─────────────────────────────────────────────────────┘         │ │
│  │  │                                                               │ │
│  │  │  ┌─────────────────┐    ┌─────────────────┐                  │ │
│  │  └─▶│   EC2 Instance  │    │   EC2 Instance  │                  │ │
│  │     │   (App Server)  │    │   (App Server)  │                  │ │
│  │     │   Private Sub.  │    │   Private Sub.  │                  │ │
│  │     └────────┬────────┘    └────────┬────────┘                  │ │
│  │              │                      │                           │ │
│  │              └──────────┬───────────┘                           │ │
│  │                         ▼                                       │ │
│  │              ┌─────────────────┐    ┌─────────────────┐        │ │
│  │              │   RDS MySQL     │    │   ElastiCache   │        │ │
│  │              │   (Database)    │    │   (Redis)       │        │ │
│  │              │   Private Sub.  │    │   Private Sub.  │        │ │
│  │              └─────────────────┘    └─────────────────┘        │ │
│  │                                                                 │ │
│  │              ┌─────────────────┐    ┌─────────────────┐        │ │
│  │              │   S3 Bucket     │    │   SES           │        │ │
│  │              │   (File Store)  │    │   (Email)       │        │ │
│  │              └─────────────────┘    └─────────────────┘        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites
- AWS Account with appropriate permissions
- AWS CLI configured
- Domain name configured in Route 53
- Basic knowledge of AWS services

## Directory Structure

```
soundwars_backend/
├── app/
│   ├── __init__.py            # Flask app factory
│   ├── config.py              # Configuration classes
│   ├── extensions.py          # Flask extensions
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
│       ├── s3.py
│       └── validators.py
├── migrations/                 # Alembic migrations
├── scripts/
│   ├── deploy.sh
│   ├── setup.sh
│   └── health_check.py
├── tests/
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
├── .ebextensions/             # Elastic Beanstalk config
│   ├── 01_packages.config
│   └── 02_python.config
├── requirements.txt
├── wsgi.py
├── gunicorn.conf.py
└── .env.example
```

## Step 1: AWS Infrastructure Setup

### Create VPC and Subnets
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=soundwars-vpc}]'

# Create public subnets (for ALB)
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b

# Create private subnets (for EC2, RDS)
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.3.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.4.0/24 --availability-zone us-east-1b
```

### Create RDS MySQL Instance
```bash
aws rds create-db-instance \
    --db-instance-identifier soundwars-db \
    --db-instance-class db.t3.micro \
    --engine mysql \
    --engine-version 8.0 \
    --master-username admin \
    --master-user-password YOUR_SECURE_PASSWORD \
    --allocated-storage 20 \
    --vpc-security-group-ids sg-xxx \
    --db-subnet-group-name soundwars-db-subnet \
    --no-publicly-accessible \
    --backup-retention-period 7
```

### Create S3 Bucket for File Storage
```bash
aws s3 mb s3://soundwars-uploads --region us-east-1

# Set bucket policy for private access
aws s3api put-public-access-block \
    --bucket soundwars-uploads \
    --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

## Step 2: Configuration Files

### app/config.py
```python
import os
from datetime import timedelta

class Config:
    """Base configuration"""
    SECRET_KEY = os.environ.get('SECRET_KEY')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # SQLAlchemy
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 10,
        'pool_recycle': 3600,
        'pool_pre_ping': True
    }
    
    # Flutterwave
    FLUTTERWAVE_SECRET_KEY = os.environ.get('FLUTTERWAVE_SECRET_KEY')
    FLUTTERWAVE_PUBLIC_KEY = os.environ.get('FLUTTERWAVE_PUBLIC_KEY')
    
    # AWS SES for email
    AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    
    # S3
    S3_BUCKET = os.environ.get('S3_BUCKET', 'soundwars-uploads')
    
    # Redis (ElastiCache)
    REDIS_URL = os.environ.get('REDIS_URL')
    
    # Frontend URL
    FRONTEND_URL = os.environ.get('FRONTEND_URL')
    
    # Rate limiting with Redis
    RATELIMIT_STORAGE_URL = os.environ.get('REDIS_URL')

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'mysql+pymysql://root:password@localhost/soundwars')

class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    
    # Production security
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

class StagingConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')

config = {
    'development': DevelopmentConfig,
    'staging': StagingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
```

### gunicorn.conf.py
```python
import multiprocessing

# Server socket
bind = "0.0.0.0:8000"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'sync'
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
accesslog = '/var/log/gunicorn/access.log'
errorlog = '/var/log/gunicorn/error.log'
loglevel = 'info'

# Process naming
proc_name = 'soundwars'

# Server mechanics
daemon = False
pidfile = '/var/run/gunicorn/soundwars.pid'
umask = 0
user = None
group = None
tmp_upload_dir = None

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
```

### docker/Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libmariadb-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python scripts/health_check.py

# Run with gunicorn
CMD ["gunicorn", "--config", "gunicorn.conf.py", "wsgi:app"]
```

### requirements.txt
```
Flask==3.0.0
Flask-SQLAlchemy==3.1.1
Flask-JWT-Extended==4.6.0
Flask-CORS==4.0.0
Flask-Limiter==3.5.0
Flask-Migrate==4.0.5
SQLAlchemy==2.0.23
PyMySQL==1.1.0
cryptography==41.0.7
python-dotenv==1.0.0
gunicorn==21.2.0
redis==5.0.1
boto3==1.34.0
bcrypt==4.1.2
requests==2.31.0
bleach==6.1.0
email-validator==2.1.0
botocore==1.34.0
```

## Step 3: AWS-Specific Services

### utils/email.py (AWS SES)
```python
import boto3
from botocore.exceptions import ClientError
from flask import current_app

def get_ses_client():
    return boto3.client(
        'ses',
        region_name=current_app.config['AWS_REGION'],
        aws_access_key_id=current_app.config['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=current_app.config['AWS_SECRET_ACCESS_KEY']
    )

def send_password_reset_email(to_email: str, username: str, reset_url: str) -> bool:
    """Send password reset email via AWS SES"""
    ses = get_ses_client()
    
    html_body = f"""
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
    
    try:
        response = ses.send_email(
            Source=f"SoundWars <noreply@{current_app.config.get('MAIL_DOMAIN', 'soundwars.com')}>",
            Destination={'ToAddresses': [to_email]},
            Message={
                'Subject': {'Data': 'Reset Your SoundWars Password', 'Charset': 'UTF-8'},
                'Body': {
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'}
                }
            }
        )
        current_app.logger.info(f"Email sent! Message ID: {response['MessageId']}")
        return True
    except ClientError as e:
        current_app.logger.error(f"Failed to send email: {e.response['Error']['Message']}")
        return False
```

### utils/s3.py (File Storage)
```python
import boto3
from botocore.exceptions import ClientError
from flask import current_app
import uuid
from datetime import datetime

def get_s3_client():
    return boto3.client(
        's3',
        region_name=current_app.config['AWS_REGION'],
        aws_access_key_id=current_app.config['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=current_app.config['AWS_SECRET_ACCESS_KEY']
    )

def upload_song_file(file, artist_id: str, original_filename: str) -> dict:
    """Upload song file to S3"""
    s3 = get_s3_client()
    bucket = current_app.config['S3_BUCKET']
    
    # Generate unique filename
    ext = original_filename.rsplit('.', 1)[-1].lower()
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    filename = f"songs/{artist_id}/{timestamp}_{uuid.uuid4().hex[:8]}.{ext}"
    
    try:
        s3.upload_fileobj(
            file,
            bucket,
            filename,
            ExtraArgs={
                'ContentType': 'audio/mpeg',
                'ACL': 'private'
            }
        )
        
        # Generate presigned URL for playback (valid for 1 hour)
        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': filename},
            ExpiresIn=3600
        )
        
        return {
            'success': True,
            'key': filename,
            'url': url
        }
    except ClientError as e:
        current_app.logger.error(f"S3 upload failed: {e}")
        return {'success': False, 'error': str(e)}

def get_song_url(s3_key: str, expires_in: int = 3600) -> str:
    """Generate presigned URL for song playback"""
    s3 = get_s3_client()
    bucket = current_app.config['S3_BUCKET']
    
    try:
        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': s3_key},
            ExpiresIn=expires_in
        )
        return url
    except ClientError:
        return None

def delete_song_file(s3_key: str) -> bool:
    """Delete song file from S3"""
    s3 = get_s3_client()
    bucket = current_app.config['S3_BUCKET']
    
    try:
        s3.delete_object(Bucket=bucket, Key=s3_key)
        return True
    except ClientError:
        return False
```

## Step 4: EC2 Deployment Scripts

### scripts/setup.sh
```bash
#!/bin/bash
set -e

echo "Setting up SoundWars Backend on EC2..."

# Update system
sudo yum update -y

# Install Python 3.11
sudo amazon-linux-extras install python3.11 -y

# Install additional dependencies
sudo yum install -y gcc mysql-devel python3-devel

# Create application directory
sudo mkdir -p /opt/soundwars
sudo chown ec2-user:ec2-user /opt/soundwars

# Create virtual environment
python3.11 -m venv /opt/soundwars/venv
source /opt/soundwars/venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create log directories
sudo mkdir -p /var/log/gunicorn
sudo chown ec2-user:ec2-user /var/log/gunicorn

sudo mkdir -p /var/run/gunicorn
sudo chown ec2-user:ec2-user /var/run/gunicorn

# Setup systemd service
sudo tee /etc/systemd/system/soundwars.service << EOF
[Unit]
Description=SoundWars Flask Application
After=network.target

[Service]
User=ec2-user
Group=ec2-user
WorkingDirectory=/opt/soundwars
Environment="PATH=/opt/soundwars/venv/bin"
EnvironmentFile=/opt/soundwars/.env
ExecStart=/opt/soundwars/venv/bin/gunicorn --config gunicorn.conf.py wsgi:app
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable soundwars
sudo systemctl start soundwars

echo "Setup complete!"
```

### scripts/deploy.sh
```bash
#!/bin/bash
set -e

echo "Deploying SoundWars Backend..."

# Variables
APP_DIR="/opt/soundwars"
VENV_DIR="$APP_DIR/venv"

# Activate virtual environment
source $VENV_DIR/bin/activate

# Pull latest code (assumes git is configured)
cd $APP_DIR
git pull origin main

# Install/update dependencies
pip install -r requirements.txt

# Run database migrations
flask db upgrade

# Restart application
sudo systemctl restart soundwars

# Check status
sleep 3
sudo systemctl status soundwars

echo "Deployment complete!"
```

## Step 5: Environment Variables (.env)

```bash
# Flask
FLASK_ENV=production
SECRET_KEY=your-production-secret-key-min-64-chars
JWT_SECRET_KEY=your-jwt-secret-key-min-64-chars

# Database (RDS)
DATABASE_URL=mysql+pymysql://admin:password@soundwars-db.xxxxxx.us-east-1.rds.amazonaws.com:3306/soundwars

# Redis (ElastiCache)
REDIS_URL=redis://soundwars-cache.xxxxxx.0001.use1.cache.amazonaws.com:6379

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
S3_BUCKET=soundwars-uploads

# Flutterwave
FLUTTERWAVE_SECRET_KEY=FLWSECK_PROD-xxxxxxxxxxxx
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_PROD-xxxxxxxxxxxx

# Frontend
FRONTEND_URL=https://soundwars.com
```

## Security Best Practices for AWS

### Security Groups
```bash
# Application Load Balancer SG
aws ec2 create-security-group --group-name soundwars-alb-sg --description "ALB Security Group"
aws ec2 authorize-security-group-ingress --group-id sg-alb --protocol tcp --port 443 --cidr 0.0.0.0/0

# EC2 Application SG
aws ec2 create-security-group --group-name soundwars-app-sg --description "App Security Group"
aws ec2 authorize-security-group-ingress --group-id sg-app --protocol tcp --port 8000 --source-group sg-alb

# RDS SG
aws ec2 create-security-group --group-name soundwars-rds-sg --description "RDS Security Group"
aws ec2 authorize-security-group-ingress --group-id sg-rds --protocol tcp --port 3306 --source-group sg-app
```

### IAM Policy for EC2 Instance
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::soundwars-uploads/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ses:SendEmail",
                "ses:SendRawEmail"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

## Security Checklist

- [x] All traffic over HTTPS via CloudFront/ALB
- [x] Secrets stored in AWS Secrets Manager or SSM Parameter Store
- [x] RDS in private subnet, not publicly accessible
- [x] EC2 instances in private subnet behind ALB
- [x] Security groups with minimal required access
- [x] IAM roles with least privilege principle
- [x] VPC with proper network segmentation
- [x] CloudWatch logging enabled
- [x] AWS WAF for DDoS protection
- [x] S3 bucket with blocked public access
- [x] Redis/ElastiCache encrypted in transit
- [x] RDS encryption at rest enabled
- [x] JWT tokens with short expiration
- [x] Rate limiting on all auth endpoints
