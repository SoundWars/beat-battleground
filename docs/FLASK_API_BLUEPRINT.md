# Flask API Blueprint - SoundWars Music Competition

Complete backend API specification for the music streaming competition platform.
**Payment Gateway: Flutterwave**

## Environment Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install flask flask-sqlalchemy flask-jwt-extended flask-cors flask-migrate
pip install python-dotenv boto3 werkzeug requests
```

### Environment Variables (.env)

```env
# Flask Configuration
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/soundwars

# Flutterwave Payment (for artist registration fees)
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxxxx
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxxxx
FLUTTERWAVE_ENCRYPTION_KEY=FLWSECK_TESTxxxxx
FLUTTERWAVE_WEBHOOK_SECRET=your-webhook-secret

# AWS S3 (for MP3 storage)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=soundwars-songs
AWS_REGION=us-east-1

# Frontend URL (for CORS and redirects)
FRONTEND_URL=http://localhost:5173
```

---

## Database Models (models.py)

```python
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from enum import Enum
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class UserRole(Enum):
    USER = "user"
    ARTIST = "artist"
    ADMIN = "admin"

class ContestPhase(Enum):
    REGISTRATION = "registration"
    VOTING = "voting"
    CLOSED = "closed"

class PaymentStatus(Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    artist_profile = db.relationship('Artist', backref='user', uselist=False, lazy=True)
    votes = db.relationship('Vote', backref='voter', lazy=True)
    payments = db.relationship('Payment', backref='user', lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'role': self.role.value,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat(),
            'artist_profile': self.artist_profile.to_dict() if self.artist_profile else None
        }


class Artist(db.Model):
    __tablename__ = 'artists'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    artist_name = db.Column(db.String(100), nullable=False, index=True)
    genre = db.Column(db.String(50))
    bio = db.Column(db.Text)
    profile_image_url = db.Column(db.String(500))
    social_links = db.Column(db.JSON)  # {"instagram": "...", "spotify": "..."}
    is_verified = db.Column(db.Boolean, default=False)
    registration_paid = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    songs = db.relationship('Song', backref='artist', lazy=True)
    contest_wins = db.relationship('ContestWinner', backref='artist', lazy=True)
    
    @property
    def is_past_winner(self):
        """Check if artist won any contest in the last 12 months"""
        cooldown_date = datetime.utcnow() - timedelta(days=365)
        return any(win.won_at >= cooldown_date for win in self.contest_wins)
    
    @property
    def can_participate(self):
        """Check if artist can participate in current contest"""
        return not self.is_past_winner
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'artist_name': self.artist_name,
            'genre': self.genre,
            'bio': self.bio,
            'profile_image_url': self.profile_image_url,
            'social_links': self.social_links,
            'is_verified': self.is_verified,
            'registration_paid': self.registration_paid,
            'is_past_winner': self.is_past_winner,
            'can_participate': self.can_participate,
            'songs': [song.to_dict() for song in self.songs]
        }


class ContestWinner(db.Model):
    """Track contest winners to prevent re-participation"""
    __tablename__ = 'contest_winners'
    
    id = db.Column(db.Integer, primary_key=True)
    artist_id = db.Column(db.Integer, db.ForeignKey('artists.id'), nullable=False)
    contest_id = db.Column(db.Integer, db.ForeignKey('contests.id'), nullable=False)
    song_id = db.Column(db.Integer, db.ForeignKey('songs.id'), nullable=False)
    final_vote_count = db.Column(db.Integer, nullable=False)
    prize_amount = db.Column(db.Integer)
    won_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Unique constraint: one winner per contest
    __table_args__ = (
        db.UniqueConstraint('contest_id', name='unique_contest_winner'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'artist_id': self.artist_id,
            'contest_id': self.contest_id,
            'song_id': self.song_id,
            'final_vote_count': self.final_vote_count,
            'prize_amount': self.prize_amount,
            'won_at': self.won_at.isoformat()
        }


class Song(db.Model):
    __tablename__ = 'songs'
    
    id = db.Column(db.Integer, primary_key=True)
    artist_id = db.Column(db.Integer, db.ForeignKey('artists.id'), nullable=False)
    contest_id = db.Column(db.Integer, db.ForeignKey('contests.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    genre = db.Column(db.String(50))
    duration_seconds = db.Column(db.Integer)
    file_url = db.Column(db.String(500), nullable=False)
    cover_image_url = db.Column(db.String(500))
    is_approved = db.Column(db.Boolean, default=False)
    is_rejected = db.Column(db.Boolean, default=False)
    rejection_reason = db.Column(db.Text)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_at = db.Column(db.DateTime)
    
    # Relationships
    votes = db.relationship('Vote', backref='song', lazy=True)
    
    @property
    def vote_count(self):
        return len(self.votes)
    
    def to_dict(self, include_votes=True):
        data = {
            'id': self.id,
            'artist_id': self.artist_id,
            'contest_id': self.contest_id,
            'title': self.title,
            'genre': self.genre,
            'duration_seconds': self.duration_seconds,
            'file_url': self.file_url,
            'cover_image_url': self.cover_image_url,
            'is_approved': self.is_approved,
            'submitted_at': self.submitted_at.isoformat(),
            'artist': {
                'id': self.artist.id,
                'artist_name': self.artist.artist_name,
                'profile_image_url': self.artist.profile_image_url
            }
        }
        if include_votes:
            data['vote_count'] = self.vote_count
        return data


class Vote(db.Model):
    __tablename__ = 'votes'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    song_id = db.Column(db.Integer, db.ForeignKey('songs.id'), nullable=False)
    contest_id = db.Column(db.Integer, db.ForeignKey('contests.id'), nullable=False)
    voted_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # SECURITY: Unique constraint - ONE vote per user per contest
    __table_args__ = (
        db.UniqueConstraint('user_id', 'contest_id', name='unique_user_contest_vote'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'song_id': self.song_id,
            'contest_id': self.contest_id,
            'voted_at': self.voted_at.isoformat()
        }


class Contest(db.Model):
    __tablename__ = 'contests'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    registration_start = db.Column(db.DateTime, nullable=False)
    registration_end = db.Column(db.DateTime, nullable=False)
    voting_start = db.Column(db.DateTime, nullable=False)
    voting_end = db.Column(db.DateTime, nullable=False)
    registration_fee = db.Column(db.Integer, default=25000)  # In kobo (₦25,000)
    prize_pool = db.Column(db.Integer)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    songs = db.relationship('Song', backref='contest', lazy=True)
    votes = db.relationship('Vote', backref='contest', lazy=True)
    winner = db.relationship('ContestWinner', backref='contest', uselist=False, lazy=True)
    
    @property
    def phase(self):
        now = datetime.utcnow()
        if now < self.registration_start:
            return ContestPhase.CLOSED
        elif now <= self.registration_end:
            return ContestPhase.REGISTRATION
        elif now <= self.voting_end:
            return ContestPhase.VOTING
        else:
            return ContestPhase.CLOSED
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'registration_start': self.registration_start.isoformat(),
            'registration_end': self.registration_end.isoformat(),
            'voting_start': self.voting_start.isoformat(),
            'voting_end': self.voting_end.isoformat(),
            'registration_fee': self.registration_fee,
            'prize_pool': self.prize_pool,
            'phase': self.phase.value,
            'is_active': self.is_active,
            'winner': self.winner.to_dict() if self.winner else None
        }


class Payment(db.Model):
    __tablename__ = 'payments'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    contest_id = db.Column(db.Integer, db.ForeignKey('contests.id'), nullable=False)
    flw_transaction_id = db.Column(db.String(255), unique=True)
    flw_tx_ref = db.Column(db.String(255), unique=True, nullable=False)
    flw_flw_ref = db.Column(db.String(255))
    amount = db.Column(db.Integer, nullable=False)  # In kobo
    currency = db.Column(db.String(3), default='NGN')
    status = db.Column(db.Enum(PaymentStatus), default=PaymentStatus.PENDING)
    payment_type = db.Column(db.String(50), default='artist_registration')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'contest_id': self.contest_id,
            'tx_ref': self.flw_tx_ref,
            'amount': self.amount,
            'currency': self.currency,
            'status': self.status.value,
            'payment_type': self.payment_type,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }
```

---

## API Endpoints

### Authentication Routes (routes/auth.py)

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import db, User, UserRole, Artist
import re

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# SECURITY: Input validation
def validate_email(email):
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    return re.match(pattern, email) is not None

def validate_password(password):
    return len(password) >= 8

def sanitize_input(text, max_length=100):
    if not text:
        return text
    # Remove potential HTML/script tags
    cleaned = re.sub(r'[<>]', '', str(text))
    return cleaned[:max_length].strip()


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register new user or artist
    
    Request Body:
    {
        "email": "user@example.com",
        "password": "securepassword",
        "name": "John Doe",
        "role": "user" | "artist",
        "artist_name": "DJ Example",  # Required if role=artist
        "genre": "Electronic"          # Optional, for artists
    }
    
    Response (201):
    {
        "message": "Registration successful",
        "user": { ...user_data },
        "requires_payment": true,  # If artist
        "is_past_winner": false,   # SECURITY: Check winner status
        "access_token": "jwt_token"
    }
    """
    data = request.get_json()
    
    # SECURITY: Validate and sanitize inputs
    email = sanitize_input(data.get('email', ''), 255)
    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400
    
    password = data.get('password', '')
    if not validate_password(password):
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    name = sanitize_input(data.get('name', ''), 100)
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    
    # Check if email exists
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400
    
    # Create user
    role = UserRole.ARTIST if data.get('role') == 'artist' else UserRole.USER
    user = User(
        email=email,
        name=name,
        role=role
    )
    user.set_password(password)
    db.session.add(user)
    db.session.flush()
    
    # Create artist profile if needed
    requires_payment = False
    is_past_winner = False
    
    if role == UserRole.ARTIST:
        artist_name = sanitize_input(data.get('artist_name', name), 50)
        genre = sanitize_input(data.get('genre', ''), 30)
        
        artist = Artist(
            user_id=user.id,
            artist_name=artist_name,
            genre=genre,
            registration_paid=False
        )
        db.session.add(artist)
        db.session.flush()
        
        # SECURITY: Check if artist is a past winner (blocked from contest)
        is_past_winner = artist.is_past_winner
        requires_payment = not is_past_winner  # Only require payment if can participate
    
    db.session.commit()
    
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        'message': 'Registration successful',
        'user': user.to_dict(),
        'requires_payment': requires_payment,
        'is_past_winner': is_past_winner,  # Frontend uses this to block registration
        'access_token': access_token
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user"""
    data = request.get_json()
    
    email = sanitize_input(data.get('email', ''), 255)
    user = User.query.filter_by(email=email).first()
    
    if not user or not user.check_password(data.get('password', '')):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 403
    
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        'access_token': access_token,
        'user': user.to_dict()
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current authenticated user"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'user': user.to_dict()}), 200
```

---

### Payment Routes - Flutterwave (routes/payments.py)

```python
import requests
import hashlib
import hmac
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Artist, Payment, PaymentStatus, Contest
from datetime import datetime
import re

payments_bp = Blueprint('payments', __name__, url_prefix='/api/payments')

# SECURITY: Validate transaction reference format
def is_valid_tx_ref(tx_ref):
    if not tx_ref:
        return False
    pattern = r'^[a-zA-Z0-9_-]+$'
    return re.match(pattern, tx_ref) and 10 <= len(tx_ref) <= 100


@payments_bp.route('/initialize', methods=['POST'])
@jwt_required()
def initialize_payment():
    """
    Initialize Flutterwave payment for artist registration
    
    Request Body:
    {
        "contest_id": 1,
        "tx_ref": "SW-1234567890-abc123",
        "amount": 25000,
        "currency": "NGN",
        "redirect_url": "https://frontend.com/payment/success",
        "customer": {
            "email": "artist@example.com",
            "name": "Artist Name"
        },
        "customizations": {
            "title": "SoundWars Artist Registration",
            "description": "Contest participation fee",
            "logo": "https://..."
        }
    }
    
    Response (200):
    {
        "payment_link": "https://checkout.flutterwave.com/v3/hosted/pay/...",
        "tx_ref": "SW-1234567890-abc123"
    }
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    data = request.get_json()
    
    # SECURITY: Validate inputs
    tx_ref = data.get('tx_ref', '')
    if not is_valid_tx_ref(tx_ref):
        return jsonify({'error': 'Invalid transaction reference'}), 400
    
    contest_id = data.get('contest_id')
    
    if not user.artist_profile:
        return jsonify({'error': 'User is not an artist'}), 400
    
    # SECURITY: Check if artist is a past winner
    if user.artist_profile.is_past_winner:
        return jsonify({
            'error': 'Past winners cannot participate for 12 months',
            'is_past_winner': True
        }), 403
    
    if user.artist_profile.registration_paid:
        return jsonify({'error': 'Registration already paid'}), 400
    
    contest = Contest.query.get(contest_id)
    if not contest:
        return jsonify({'error': 'Contest not found'}), 404
    
    # Check for existing pending payment with same tx_ref
    existing = Payment.query.filter_by(flw_tx_ref=tx_ref).first()
    if existing:
        return jsonify({'error': 'Duplicate transaction reference'}), 400
    
    # Create Flutterwave payment
    flw_secret = current_app.config['FLUTTERWAVE_SECRET_KEY']
    
    payload = {
        "tx_ref": tx_ref,
        "amount": contest.registration_fee / 100,  # Convert from kobo to naira
        "currency": data.get('currency', 'NGN'),
        "redirect_url": data.get('redirect_url', f"{current_app.config['FRONTEND_URL']}/payment/success"),
        "customer": data.get('customer', {
            "email": user.email,
            "name": user.name
        }),
        "customizations": data.get('customizations', {
            "title": f"SoundWars - {contest.name}",
            "description": "Artist registration fee",
        }),
        "meta": {
            "user_id": str(user_id),
            "contest_id": str(contest_id),
            "payment_type": "artist_registration"
        }
    }
    
    try:
        response = requests.post(
            "https://api.flutterwave.com/v3/payments",
            json=payload,
            headers={
                "Authorization": f"Bearer {flw_secret}",
                "Content-Type": "application/json"
            }
        )
        
        flw_data = response.json()
        
        if flw_data.get('status') == 'success':
            # Create pending payment record
            payment = Payment(
                user_id=user_id,
                contest_id=contest_id,
                flw_tx_ref=tx_ref,
                amount=contest.registration_fee,
                status=PaymentStatus.PENDING
            )
            db.session.add(payment)
            db.session.commit()
            
            return jsonify({
                'payment_link': flw_data['data']['link'],
                'tx_ref': tx_ref
            }), 200
        else:
            return jsonify({'error': flw_data.get('message', 'Payment initialization failed')}), 400
            
    except requests.RequestException as e:
        return jsonify({'error': 'Payment service unavailable'}), 503


@payments_bp.route('/verify', methods=['POST'])
@jwt_required()
def verify_payment():
    """
    Verify Flutterwave payment after redirect
    
    Request Body:
    {
        "transaction_id": "1234567890",
        "tx_ref": "SW-1234567890-abc123",
        "status": "successful"
    }
    
    Response (200):
    {
        "status": "success",
        "payment": { ...payment_data }
    }
    """
    data = request.get_json()
    transaction_id = data.get('transaction_id')
    tx_ref = data.get('tx_ref')
    
    # SECURITY: Validate tx_ref format
    if tx_ref and not is_valid_tx_ref(tx_ref):
        return jsonify({'error': 'Invalid transaction reference'}), 400
    
    payment = Payment.query.filter_by(flw_tx_ref=tx_ref).first()
    
    if not payment:
        return jsonify({'error': 'Payment not found'}), 404
    
    # Already completed
    if payment.status == PaymentStatus.COMPLETED:
        return jsonify({
            'status': 'success',
            'payment': payment.to_dict()
        }), 200
    
    # Verify with Flutterwave API (CRITICAL: Server-side verification)
    flw_secret = current_app.config['FLUTTERWAVE_SECRET_KEY']
    
    try:
        verify_url = f"https://api.flutterwave.com/v3/transactions/{transaction_id}/verify"
        response = requests.get(
            verify_url,
            headers={"Authorization": f"Bearer {flw_secret}"}
        )
        
        flw_data = response.json()
        
        if (flw_data.get('status') == 'success' and 
            flw_data['data']['status'] == 'successful' and
            flw_data['data']['tx_ref'] == tx_ref and
            flw_data['data']['amount'] >= payment.amount / 100):
            
            # Payment verified successfully
            payment.status = PaymentStatus.COMPLETED
            payment.flw_transaction_id = str(transaction_id)
            payment.flw_flw_ref = flw_data['data'].get('flw_ref')
            payment.completed_at = datetime.utcnow()
            
            # Mark artist as paid
            user = User.query.get(payment.user_id)
            if user and user.artist_profile:
                user.artist_profile.registration_paid = True
            
            db.session.commit()
            
            return jsonify({
                'status': 'success',
                'payment': payment.to_dict()
            }), 200
        else:
            payment.status = PaymentStatus.FAILED
            db.session.commit()
            return jsonify({'status': 'failed', 'error': 'Payment verification failed'}), 400
            
    except requests.RequestException:
        return jsonify({'error': 'Verification service unavailable'}), 503


@payments_bp.route('/webhook', methods=['POST'])
def flutterwave_webhook():
    """
    Flutterwave webhook handler for payment events
    SECURITY: Verify webhook signature
    """
    # Verify webhook signature
    signature = request.headers.get('verif-hash')
    secret_hash = current_app.config['FLUTTERWAVE_WEBHOOK_SECRET']
    
    if not signature or signature != secret_hash:
        return jsonify({'error': 'Invalid signature'}), 401
    
    payload = request.get_json()
    
    if payload.get('event') == 'charge.completed':
        data = payload.get('data', {})
        tx_ref = data.get('tx_ref')
        
        if data.get('status') == 'successful':
            handle_successful_payment(data)
        else:
            handle_failed_payment(data)
    
    return jsonify({'status': 'received'}), 200


def handle_successful_payment(data):
    """Mark artist registration as paid"""
    tx_ref = data.get('tx_ref')
    payment = Payment.query.filter_by(flw_tx_ref=tx_ref).first()
    
    if payment and payment.status != PaymentStatus.COMPLETED:
        payment.status = PaymentStatus.COMPLETED
        payment.flw_transaction_id = str(data.get('id'))
        payment.flw_flw_ref = data.get('flw_ref')
        payment.completed_at = datetime.utcnow()
        
        # Mark artist as paid
        user = User.query.get(payment.user_id)
        if user and user.artist_profile:
            user.artist_profile.registration_paid = True
        
        db.session.commit()


def handle_failed_payment(data):
    """Handle failed payment"""
    tx_ref = data.get('tx_ref')
    payment = Payment.query.filter_by(flw_tx_ref=tx_ref).first()
    
    if payment:
        payment.status = PaymentStatus.FAILED
        db.session.commit()


@payments_bp.route('/status/<tx_ref>', methods=['GET'])
@jwt_required()
def check_payment_status(tx_ref):
    """Check payment status by transaction reference"""
    # SECURITY: Validate tx_ref format
    if not is_valid_tx_ref(tx_ref):
        return jsonify({'error': 'Invalid transaction reference'}), 400
    
    payment = Payment.query.filter_by(flw_tx_ref=tx_ref).first()
    
    if not payment:
        return jsonify({'error': 'Payment not found'}), 404
    
    return jsonify({
        'status': payment.status.value,
        'payment': payment.to_dict()
    }), 200
```

---

### Voting Routes (routes/votes.py)

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Vote, Song, Contest, ContestPhase

votes_bp = Blueprint('votes', __name__, url_prefix='/api/votes')

@votes_bp.route('', methods=['POST'])
@jwt_required()
def cast_vote():
    """
    Cast a vote for a song
    
    SECURITY: ONE vote per user per contest - enforced at database level
    
    Request Body:
    {
        "song_id": 1
    }
    
    Response (201):
    {
        "message": "Vote cast successfully",
        "vote": { ...vote_data }
    }
    """
    user_id = get_jwt_identity()
    data = request.get_json()
    song_id = data.get('song_id')
    
    # Validate song_id
    if not song_id or not isinstance(song_id, int):
        return jsonify({'error': 'Invalid song ID'}), 400
    
    song = Song.query.get(song_id)
    if not song:
        return jsonify({'error': 'Song not found'}), 404
    
    if not song.is_approved:
        return jsonify({'error': 'Song is not approved for voting'}), 400
    
    contest = Contest.query.get(song.contest_id)
    if contest.phase != ContestPhase.VOTING:
        return jsonify({'error': 'Voting is not open for this contest'}), 400
    
    # SECURITY: Check if user already voted in this contest
    existing_vote = Vote.query.filter_by(
        user_id=user_id,
        contest_id=song.contest_id
    ).first()
    
    if existing_vote:
        return jsonify({
            'error': 'You have already voted in this contest. Only one vote per user is allowed.',
            'voted_song_id': existing_vote.song_id,
            'has_voted': True
        }), 400
    
    # SECURITY: Artists cannot vote for their own songs
    user = User.query.get(user_id)
    if user.artist_profile and song.artist_id == user.artist_profile.id:
        return jsonify({'error': 'You cannot vote for your own song'}), 400
    
    try:
        vote = Vote(
            user_id=user_id,
            song_id=song_id,
            contest_id=song.contest_id
        )
        db.session.add(vote)
        db.session.commit()
        
        return jsonify({
            'message': 'Vote cast successfully',
            'vote': vote.to_dict()
        }), 201
    except Exception as e:
        # Database constraint will also prevent duplicate votes
        db.session.rollback()
        return jsonify({'error': 'Failed to cast vote. You may have already voted.'}), 400


@votes_bp.route('/my-vote', methods=['GET'])
@jwt_required()
def get_my_vote():
    """
    Get current user's vote for active contest
    Used to disable vote buttons on frontend after voting
    """
    user_id = get_jwt_identity()
    
    # Get active contest
    contest = Contest.query.filter_by(is_active=True).first()
    if not contest:
        return jsonify({'has_voted': False, 'error': 'No active contest'}), 200
    
    vote = Vote.query.filter_by(
        user_id=user_id,
        contest_id=contest.id
    ).first()
    
    if not vote:
        return jsonify({'has_voted': False}), 200
    
    return jsonify({
        'has_voted': True,
        'vote': vote.to_dict(),
        'song': vote.song.to_dict()
    }), 200


@votes_bp.route('/has-voted', methods=['GET'])
@jwt_required()
def check_has_voted():
    """Quick check if user has voted in current contest"""
    user_id = get_jwt_identity()
    
    contest = Contest.query.filter_by(is_active=True).first()
    if not contest:
        return jsonify({'has_voted': False}), 200
    
    has_voted = Vote.query.filter_by(
        user_id=user_id,
        contest_id=contest.id
    ).first() is not None
    
    return jsonify({'has_voted': has_voted}), 200
```

---

### Admin Routes (routes/admin.py)

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from models import db, User, UserRole, Song, Artist, Contest, Payment, Vote, ContestWinner
from sqlalchemy import func
from datetime import datetime

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

def admin_required(fn):
    """Decorator to require admin role"""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != UserRole.ADMIN:
            return jsonify({'error': 'Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper


@admin_bp.route('/dashboard', methods=['GET'])
@admin_required
def get_dashboard_stats():
    """Get admin dashboard statistics"""
    active_contest = Contest.query.filter_by(is_active=True).first()
    
    stats = {
        'total_users': User.query.count(),
        'total_artists': Artist.query.count(),
        'paid_artists': Artist.query.filter_by(registration_paid=True).count(),
        'total_songs': Song.query.count(),
        'approved_songs': Song.query.filter_by(is_approved=True).count(),
        'pending_songs': Song.query.filter_by(is_approved=False, is_rejected=False).count(),
        'total_votes': Vote.query.count(),
        'total_revenue': db.session.query(func.sum(Payment.amount)).filter_by(
            status='completed'
        ).scalar() or 0,
        'active_contest': active_contest.to_dict() if active_contest else None,
        'past_winners_count': ContestWinner.query.count()
    }
    
    return jsonify(stats), 200


@admin_bp.route('/contests/<int:contest_id>/finalize', methods=['POST'])
@admin_required
def finalize_contest(contest_id):
    """
    Finalize a contest and declare winner
    This adds the winner to ContestWinner table, blocking them from future contests
    """
    contest = Contest.query.get(contest_id)
    
    if not contest:
        return jsonify({'error': 'Contest not found'}), 404
    
    if contest.winner:
        return jsonify({'error': 'Contest already has a winner'}), 400
    
    # Find song with most votes
    winner_song = db.session.query(
        Song,
        func.count(Vote.id).label('vote_count')
    ).outerjoin(
        Vote, Vote.song_id == Song.id
    ).filter(
        Song.contest_id == contest_id,
        Song.is_approved == True
    ).group_by(
        Song.id
    ).order_by(
        func.count(Vote.id).desc()
    ).first()
    
    if not winner_song:
        return jsonify({'error': 'No eligible songs found'}), 400
    
    song, vote_count = winner_song
    
    # Create winner record (this blocks artist from future contests for 12 months)
    contest_winner = ContestWinner(
        artist_id=song.artist_id,
        contest_id=contest_id,
        song_id=song.id,
        final_vote_count=vote_count,
        prize_amount=contest.prize_pool
    )
    
    db.session.add(contest_winner)
    contest.is_active = False
    db.session.commit()
    
    return jsonify({
        'message': 'Contest finalized',
        'winner': contest_winner.to_dict(),
        'song': song.to_dict(),
        'artist': song.artist.to_dict()
    }), 200


@admin_bp.route('/winners', methods=['GET'])
@admin_required
def get_all_winners():
    """Get all past contest winners"""
    winners = ContestWinner.query.order_by(ContestWinner.won_at.desc()).all()
    
    return jsonify({
        'winners': [{
            **w.to_dict(),
            'artist': Artist.query.get(w.artist_id).to_dict(),
            'song': Song.query.get(w.song_id).to_dict(),
            'contest': Contest.query.get(w.contest_id).to_dict()
        } for w in winners]
    }), 200


# ... (other admin endpoints remain the same)
```

---

## Main Application (app.py)

```python
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from models import db
from routes.auth import auth_bp
from routes.payments import payments_bp
from routes.votes import votes_bp
from routes.leaderboard import leaderboard_bp
from routes.admin import admin_bp
from routes.artists import artists_bp
from routes.songs import songs_bp
import os
from dotenv import load_dotenv

load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
    
    # Flutterwave Configuration
    app.config['FLUTTERWAVE_SECRET_KEY'] = os.getenv('FLUTTERWAVE_SECRET_KEY')
    app.config['FLUTTERWAVE_PUBLIC_KEY'] = os.getenv('FLUTTERWAVE_PUBLIC_KEY')
    app.config['FLUTTERWAVE_WEBHOOK_SECRET'] = os.getenv('FLUTTERWAVE_WEBHOOK_SECRET')
    
    app.config['FRONTEND_URL'] = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    
    # Initialize extensions
    db.init_app(app)
    CORS(app, origins=[app.config['FRONTEND_URL']])
    JWTManager(app)
    Migrate(app, db)
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(votes_bp)
    app.register_blueprint(leaderboard_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(artists_bp)
    app.register_blueprint(songs_bp)
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
```

---

## Security Summary

### 1. Payment Security (Flutterwave)
- Server-side payment verification is **mandatory**
- Transaction reference format validation
- Webhook signature verification
- Duplicate payment prevention

### 2. Voting Security
- **One vote per user per contest** - enforced at database level with unique constraint
- Vote buttons disabled on frontend after voting
- Artists cannot vote for their own songs
- Server-side validation of voting eligibility

### 3. Winner Blocking
- Past winners tracked in `ContestWinner` table
- Winners cannot participate for 12 months after winning
- `is_past_winner` flag checked during registration
- Frontend blocks registration for past winners

### 4. Input Validation
- Email format validation
- Password minimum length (8 chars)
- Input sanitization (HTML tag removal)
- Length limits on all text inputs

---

## Frontend Integration Notes

The React frontend is configured to use:
- **Development**: `http://localhost:5000/api`
- **Production**: Set `VITE_API_BASE_URL` environment variable

Artist registration fee: **₦25,000** (Nigerian Naira)

All API configuration is centralized in `src/config/api.ts`.
