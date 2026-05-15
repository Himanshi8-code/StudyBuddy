# auth.py — JWT and password utilities
import jwt
import bcrypt
import os
from functools import wraps
from flask import request, jsonify

SECRET = os.getenv('JWT_SECRET', 'studybuddy_secret_2024')

def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def check_password(password, hashed):
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(payload):
    import time
    payload['exp'] = int(time.time()) + 7 * 24 * 3600  # 7 days
    return jwt.encode(payload, SECRET, algorithm='HS256')

def decode_token(token):
    return jwt.decode(token, SECRET, algorithms=['HS256'])

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401
        try:
            token = auth[7:]
            request.user = decode_token(token)
        except Exception:
            return jsonify({'error': 'Invalid or expired token'}), 401
        return f(*args, **kwargs)
    return decorated
