# auth.py — JWT and password utilities

import os
import time
import jwt
import bcrypt
from functools import wraps
from flask import request, jsonify
from dotenv import load_dotenv

load_dotenv()


def _secret() -> str:
    # Must be identical for create_token() and decode_token()
    return os.getenv("JWT_SECRET", "studybuddy_secret_2024")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(payload: dict) -> str:
    payload = dict(payload)
    payload["exp"] = int(time.time()) + 7 * 24 * 3600  # 7 days
    return jwt.encode(payload, _secret(), algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=["HS256"])


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "No token provided"}), 401

        token = auth[7:]
        try:
            request.user = decode_token(token)
        except Exception as e:
            print("JWT ERROR:", str(e))
            return jsonify({"error": str(e)}), 401
        
        return f(*args, **kwargs)

    return decorated

