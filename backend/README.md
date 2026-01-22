# SoundWars Flask Backend API

A Flask-based REST API for the SoundWars music competition platform.

## Features

- 🔐 JWT Authentication with password reset
- 💳 Flutterwave payment integration
- 🗳️ One-vote-per-contest voting system
- 🏆 Winner tracking and eligibility management
- 📧 Email notifications
- 🔒 Input validation and security measures

## Project Structure

```
backend/
├── app.py              # Main Flask application
├── config.py           # Configuration settings
├── requirements.txt    # Python dependencies
├── passenger_wsgi.py   # cPanel Passenger entry point
├── wsgi.py            # Gunicorn entry point
├── .env.example       # Environment variables template
├── models/
│   ├── __init__.py
│   ├── user.py
│   ├── artist.py
│   ├── song.py
│   ├── vote.py
│   ├── contest.py
│   └── payment.py
├── routes/
│   ├── __init__.py
│   ├── auth.py
│   ├── artists.py
│   ├── songs.py
│   ├── votes.py
│   ├── payments.py
│   ├── leaderboard.py
│   └── admin.py
└── utils/
    ├── __init__.py
    ├── security.py
    └── email.py
```

## Quick Start

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Run development server
python app.py
```

### cPanel Deployment

See `docs/CPANEL_BACKEND_DEPLOYMENT.md` for detailed instructions.

1. Create Python App in cPanel
2. Upload backend files to application root
3. Configure `.env` with production values
4. Install dependencies via SSH or cPanel
5. Restart application

### AWS Deployment

See `docs/AWS_BACKEND_DEPLOYMENT.md` for detailed instructions.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user

### Artists
- `GET /api/artists` - List verified artists
- `GET /api/artists/:id` - Get artist by ID
- `POST /api/artists/create` - Create artist profile
- `PUT /api/artists/profile` - Update profile

### Songs
- `GET /api/songs` - Get approved songs
- `POST /api/songs/submit` - Submit song
- `GET /api/songs/my-submissions` - Get user's submissions

### Voting
- `POST /api/votes/cast` - Cast vote
- `GET /api/votes/status` - Check vote status

### Leaderboard
- `GET /api/leaderboard` - Get current leaderboard
- `GET /api/leaderboard/top/:limit` - Get top N songs

### Payments
- `POST /api/payments/initialize` - Initialize payment
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/webhook` - Flutterwave webhook

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/songs/pending` - Pending songs
- `POST /api/admin/songs/:id/approve` - Approve song
- `POST /api/admin/contests/:id/finalize` - Finalize contest

## Security Features

- ✅ Password hashing with Werkzeug
- ✅ JWT token authentication
- ✅ Rate limiting
- ✅ Input sanitization (XSS prevention)
- ✅ SQL injection prevention (SQLAlchemy ORM)
- ✅ CORS configuration
- ✅ Secure password reset tokens
- ✅ Payment verification with Flutterwave

## License

MIT License
