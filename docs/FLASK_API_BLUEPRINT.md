# Flask API Blueprint - SoundWars Music Competition

Complete backend API specification for the music streaming competition platform.

## Environment Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install flask flask-sqlalchemy flask-jwt-extended flask-cors flask-migrate
pip install stripe python-dotenv boto3 werkzeug
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

# Stripe Payment (for artist registration fees)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_ARTIST_PRICE_ID=price_xxxxx

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
from datetime import datetime
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
            'songs': [song.to_dict() for song in self.songs]
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
    
    # Unique constraint: one vote per user per contest
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
    registration_fee = db.Column(db.Integer, default=2500)  # In cents ($25.00)
    prize_pool = db.Column(db.Integer)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    songs = db.relationship('Song', backref='contest', lazy=True)
    votes = db.relationship('Vote', backref='contest', lazy=True)
    
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
            'is_active': self.is_active
        }


class Payment(db.Model):
    __tablename__ = 'payments'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    contest_id = db.Column(db.Integer, db.ForeignKey('contests.id'), nullable=False)
    stripe_session_id = db.Column(db.String(255), unique=True)
    stripe_payment_intent_id = db.Column(db.String(255))
    amount = db.Column(db.Integer, nullable=False)  # In cents
    currency = db.Column(db.String(3), default='USD')
    status = db.Column(db.Enum(PaymentStatus), default=PaymentStatus.PENDING)
    payment_type = db.Column(db.String(50), default='artist_registration')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'contest_id': self.contest_id,
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

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

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
        "access_token": "jwt_token"
    }
    """
    data = request.get_json()
    
    # Check if email exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400
    
    # Create user
    role = UserRole.ARTIST if data.get('role') == 'artist' else UserRole.USER
    user = User(
        email=data['email'],
        name=data['name'],
        role=role
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.flush()
    
    # Create artist profile if needed
    requires_payment = False
    if role == UserRole.ARTIST:
        artist = Artist(
            user_id=user.id,
            artist_name=data.get('artist_name', data['name']),
            genre=data.get('genre'),
            registration_paid=False
        )
        db.session.add(artist)
        requires_payment = True
    
    db.session.commit()
    
    access_token = create_access_token(identity=user.id)
    
    return jsonify({
        'message': 'Registration successful',
        'user': user.to_dict(),
        'requires_payment': requires_payment,
        'access_token': access_token
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Login user
    
    Request Body:
    {
        "email": "user@example.com",
        "password": "securepassword"
    }
    
    Response (200):
    {
        "access_token": "jwt_token",
        "user": { ...user_data }
    }
    """
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    
    if not user or not user.check_password(data['password']):
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

### Payment Routes (routes/payments.py)

```python
import stripe
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Artist, Payment, PaymentStatus, Contest
from datetime import datetime

payments_bp = Blueprint('payments', __name__, url_prefix='/api/payments')

@payments_bp.route('/create-checkout', methods=['POST'])
@jwt_required()
def create_checkout_session():
    """
    Create Stripe checkout session for artist registration
    
    Request Body:
    {
        "contest_id": 1
    }
    
    Response (200):
    {
        "checkout_url": "https://checkout.stripe.com/...",
        "session_id": "cs_xxxxx"
    }
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    data = request.get_json()
    contest_id = data.get('contest_id')
    
    if not user.artist_profile:
        return jsonify({'error': 'User is not an artist'}), 400
    
    if user.artist_profile.registration_paid:
        return jsonify({'error': 'Registration already paid'}), 400
    
    contest = Contest.query.get(contest_id)
    if not contest:
        return jsonify({'error': 'Contest not found'}), 404
    
    stripe.api_key = current_app.config['STRIPE_SECRET_KEY']
    
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'Artist Registration - {contest.name}',
                        'description': 'One-time registration fee to participate in the music competition',
                    },
                    'unit_amount': contest.registration_fee,  # Amount in cents
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{current_app.config['FRONTEND_URL']}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{current_app.config['FRONTEND_URL']}/payment/cancel",
            customer_email=user.email,
            metadata={
                'user_id': str(user_id),
                'contest_id': str(contest_id),
                'payment_type': 'artist_registration'
            }
        )
        
        # Create pending payment record
        payment = Payment(
            user_id=user_id,
            contest_id=contest_id,
            stripe_session_id=checkout_session.id,
            amount=contest.registration_fee,
            status=PaymentStatus.PENDING
        )
        db.session.add(payment)
        db.session.commit()
        
        return jsonify({
            'checkout_url': checkout_session.url,
            'session_id': checkout_session.id
        }), 200
        
    except stripe.error.StripeError as e:
        return jsonify({'error': str(e)}), 400


@payments_bp.route('/webhook', methods=['POST'])
def stripe_webhook():
    """
    Stripe webhook handler for payment events
    """
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get('Stripe-Signature')
    
    stripe.api_key = current_app.config['STRIPE_SECRET_KEY']
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, current_app.config['STRIPE_WEBHOOK_SECRET']
        )
    except ValueError:
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({'error': 'Invalid signature'}), 400
    
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        handle_successful_payment(session)
    elif event['type'] == 'payment_intent.payment_failed':
        session = event['data']['object']
        handle_failed_payment(session)
    
    return jsonify({'received': True}), 200


def handle_successful_payment(session):
    """Mark artist registration as paid"""
    payment = Payment.query.filter_by(stripe_session_id=session['id']).first()
    
    if payment:
        payment.status = PaymentStatus.COMPLETED
        payment.stripe_payment_intent_id = session.get('payment_intent')
        payment.completed_at = datetime.utcnow()
        
        # Mark artist as paid
        user = User.query.get(payment.user_id)
        if user and user.artist_profile:
            user.artist_profile.registration_paid = True
        
        db.session.commit()


def handle_failed_payment(session):
    """Handle failed payment"""
    payment = Payment.query.filter_by(
        stripe_payment_intent_id=session.get('id')
    ).first()
    
    if payment:
        payment.status = PaymentStatus.FAILED
        db.session.commit()


@payments_bp.route('/status/<session_id>', methods=['GET'])
@jwt_required()
def check_payment_status(session_id):
    """Check payment status by session ID"""
    payment = Payment.query.filter_by(stripe_session_id=session_id).first()
    
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
    Cast a vote for a song (ONE vote per user per contest)
    
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
    
    song = Song.query.get(song_id)
    if not song:
        return jsonify({'error': 'Song not found'}), 404
    
    if not song.is_approved:
        return jsonify({'error': 'Song is not approved for voting'}), 400
    
    contest = Contest.query.get(song.contest_id)
    if contest.phase != ContestPhase.VOTING:
        return jsonify({'error': 'Voting is not open for this contest'}), 400
    
    # Check if user already voted in this contest
    existing_vote = Vote.query.filter_by(
        user_id=user_id,
        contest_id=song.contest_id
    ).first()
    
    if existing_vote:
        return jsonify({
            'error': 'You have already voted in this contest',
            'voted_song_id': existing_vote.song_id
        }), 400
    
    # Artists cannot vote for their own songs
    user = User.query.get(user_id)
    if user.artist_profile and song.artist_id == user.artist_profile.id:
        return jsonify({'error': 'You cannot vote for your own song'}), 400
    
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


@votes_bp.route('/my-vote', methods=['GET'])
@jwt_required()
def get_my_vote():
    """Get current user's vote for active contest"""
    user_id = get_jwt_identity()
    
    # Get active contest
    contest = Contest.query.filter_by(is_active=True).first()
    if not contest:
        return jsonify({'error': 'No active contest'}), 404
    
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
```

---

### Leaderboard Routes (routes/leaderboard.py)

```python
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from models import db, Song, Vote, Contest

leaderboard_bp = Blueprint('leaderboard', __name__, url_prefix='/api/leaderboard')

@leaderboard_bp.route('', methods=['GET'])
def get_leaderboard():
    """
    Get leaderboard for current/specified contest
    
    Query Params:
    - contest_id: (optional) specific contest ID
    - limit: (optional) number of results (default 50)
    
    Response (200):
    {
        "contest": { ...contest_data },
        "leaderboard": [
            {
                "rank": 1,
                "song": { ...song_data },
                "vote_count": 150
            },
            ...
        ]
    }
    """
    contest_id = request.args.get('contest_id', type=int)
    limit = request.args.get('limit', 50, type=int)
    
    if contest_id:
        contest = Contest.query.get(contest_id)
    else:
        contest = Contest.query.filter_by(is_active=True).first()
    
    if not contest:
        return jsonify({'error': 'No contest found'}), 404
    
    # Get songs with vote counts, ordered by votes
    songs_with_votes = db.session.query(
        Song,
        func.count(Vote.id).label('vote_count')
    ).outerjoin(
        Vote, Vote.song_id == Song.id
    ).filter(
        Song.contest_id == contest.id,
        Song.is_approved == True
    ).group_by(
        Song.id
    ).order_by(
        func.count(Vote.id).desc()
    ).limit(limit).all()
    
    leaderboard = []
    for rank, (song, vote_count) in enumerate(songs_with_votes, 1):
        leaderboard.append({
            'rank': rank,
            'song': song.to_dict(include_votes=False),
            'vote_count': vote_count
        })
    
    return jsonify({
        'contest': contest.to_dict(),
        'leaderboard': leaderboard
    }), 200
```

---

### Admin Routes (routes/admin.py)

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from models import db, User, UserRole, Song, Artist, Contest, Payment, Vote
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
        'active_contest': active_contest.to_dict() if active_contest else None
    }
    
    return jsonify(stats), 200


@admin_bp.route('/songs/pending', methods=['GET'])
@admin_required
def get_pending_songs():
    """Get all pending song submissions"""
    songs = Song.query.filter_by(
        is_approved=False,
        is_rejected=False
    ).order_by(Song.submitted_at.desc()).all()
    
    return jsonify({
        'songs': [song.to_dict() for song in songs]
    }), 200


@admin_bp.route('/songs/<int:song_id>/approve', methods=['POST'])
@admin_required
def approve_song(song_id):
    """Approve a song submission"""
    song = Song.query.get(song_id)
    
    if not song:
        return jsonify({'error': 'Song not found'}), 404
    
    song.is_approved = True
    song.approved_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'message': 'Song approved',
        'song': song.to_dict()
    }), 200


@admin_bp.route('/songs/<int:song_id>/reject', methods=['POST'])
@admin_required
def reject_song(song_id):
    """Reject a song submission"""
    data = request.get_json()
    song = Song.query.get(song_id)
    
    if not song:
        return jsonify({'error': 'Song not found'}), 404
    
    song.is_rejected = True
    song.rejection_reason = data.get('reason', 'Does not meet guidelines')
    db.session.commit()
    
    return jsonify({
        'message': 'Song rejected',
        'song': song.to_dict()
    }), 200


@admin_bp.route('/contests', methods=['POST'])
@admin_required
def create_contest():
    """Create a new contest"""
    data = request.get_json()
    
    contest = Contest(
        name=data['name'],
        description=data.get('description'),
        registration_start=datetime.fromisoformat(data['registration_start']),
        registration_end=datetime.fromisoformat(data['registration_end']),
        voting_start=datetime.fromisoformat(data['voting_start']),
        voting_end=datetime.fromisoformat(data['voting_end']),
        registration_fee=data.get('registration_fee', 2500),
        prize_pool=data.get('prize_pool')
    )
    
    db.session.add(contest)
    db.session.commit()
    
    return jsonify({
        'message': 'Contest created',
        'contest': contest.to_dict()
    }), 201
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
    app.config['STRIPE_SECRET_KEY'] = os.getenv('STRIPE_SECRET_KEY')
    app.config['STRIPE_WEBHOOK_SECRET'] = os.getenv('STRIPE_WEBHOOK_SECRET')
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

## Project Structure

```
flask-api/
├── app.py                 # Main application
├── models.py              # SQLAlchemy models
├── requirements.txt       # Dependencies
├── .env                   # Environment variables
├── migrations/            # Flask-Migrate files
├── routes/
│   ├── __init__.py
│   ├── auth.py           # Authentication endpoints
│   ├── payments.py       # Stripe payment endpoints
│   ├── artists.py        # Artist management
│   ├── songs.py          # Song upload/management
│   ├── votes.py          # Voting endpoints
│   ├── leaderboard.py    # Leaderboard
│   └── admin.py          # Admin dashboard
├── utils/
│   ├── __init__.py
│   ├── s3.py             # AWS S3 file upload helper
│   └── decorators.py     # Custom decorators
└── tests/
    └── ...
```

---

## Frontend Integration Notes

The React frontend is configured to use:
- **Development**: `http://localhost:5000/api`
- **Production**: Set `VITE_API_BASE_URL` environment variable

Artist registration fee: **$25.00**

All API configuration is centralized in `src/config/api.ts`.
