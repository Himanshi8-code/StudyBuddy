# auth.py — JWT and password utilities

import os
import time
import jwt
import bcrypt

from functools import wraps
from flask import request, jsonify
from dotenv import load_dotenv

load_dotenv()


def _secret():
    secret = os.getenv("JWT_SECRET", "studybuddy_secret_2024")
    return secret


def hash_password(password):
    return bcrypt.hashpw(
        password.encode(),
        bcrypt.gensalt()
    ).decode()


def check_password(password, hashed):
    return bcrypt.checkpw(
        password.encode(),
        hashed.encode()
    )


def create_token(payload):
    payload = dict(payload)

    payload["exp"] = int(time.time()) + (7 * 24 * 60 * 60)

    secret = _secret()

    print("CREATE TOKEN SECRET:", secret)

    token = jwt.encode(
        payload,
        secret,
        algorithm="HS256"
    )

    return token


def decode_token(token):
    secret = _secret()

    print("DECODE TOKEN SECRET:", secret)

    decoded = jwt.decode(
        token,
        secret,
        algorithms=["HS256"]
    )

    return decoded


def require_auth(f):

    @wraps(f)
    def decorated(*args, **kwargs):

        auth_header = request.headers.get("Authorization", "")

        print("\n========== AUTH CHECK ==========")
        print("Authorization Header:", auth_header)

        if not auth_header.startswith("Bearer "):
            print("ERROR: No Bearer token found")
            return jsonify({
                "error": "No token provided"
            }), 401

        token = auth_header[7:]

        print("Token Received:", token[:50] + "...")

        try:
            user = decode_token(token)

            print("JWT SUCCESS")
            print("Decoded User:", user)

            request.user = user

        except Exception as e:

            print("\nJWT ERROR:")
            print(type(e).__name__)
            print(str(e))
            print("===============================\n")

            return jsonify({
                "error": str(e)
            }), 401

        return f(*args, **kwargs)

    return decorated