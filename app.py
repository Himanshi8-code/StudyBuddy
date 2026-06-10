import os
import json
import uuid
import time

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from groq import Groq

load_dotenv()
print(os.environ.get('GROQ_API_KEY'))

from db import get_db, init_db
from auth import hash_password, check_password, create_token, require_auth
from parser import extract_text

# ─────────────────────────────────────────────────────────────
# Flask Setup
# ─────────────────────────────────────────────────────────────

app = Flask(
    __name__,
    static_folder='static',
    template_folder='templates'
)

CORS(
    app,
    origins=[os.getenv('FRONTEND_URL', 'http://localhost:5000')],
    supports_credentials=True
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

MODEL = "llama-3.1-8b-instant"

ALLOWED_EXT = {'.pdf', '.docx', '.txt', '.md'}

# ─────────────────────────────────────────────────────────────
# Groq AI Setup
# ─────────────────────────────────────────────────────────────

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

MODEL = "llama-3.1-8b-instant"

# ─────────────────────────────────────────────────────────────
# Frontend
# ─────────────────────────────────────────────────────────────
def call_ai(system, messages, max_tokens=1000):

    combined_message = system + "\n\n"

    for msg in messages:
        combined_message += f"{msg['role']}: {msg['content']}\n"

    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": combined_message
            }
        ],
        model=MODEL,
        temperature=0.7,
        max_tokens=max_tokens
    )

    return chat_completion.choices[0].message.content

@app.route('/')
@app.route('/<path:path>')
def serve_frontend(path=''):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)

    return send_from_directory(app.template_folder, 'index.html')

# ─────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────

@app.route('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'version': '2.0.0'
    })

# ─────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.json

        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        role = data.get('role')
        org = data.get('org')

        if not all([name, email, password, role, org]):
            return jsonify({'error': 'All fields are required'}), 400

        db = get_db()

        existing = db.execute(
            'SELECT id FROM users WHERE email=?',
            (email,)
        ).fetchone()

        if existing:
            return jsonify({'error': 'Email already exists'}), 409

        uid = str(uuid.uuid4())

        db.execute(
            '''
            INSERT INTO users (id,name,email,password,role,org)
            VALUES (?,?,?,?,?,?)
            ''',
            (
                uid,
                name,
                email,
                hash_password(password),
                role,
                org
            )
        )

        db.commit()

        user = {
            'id': uid,
            'name': name,
            'email': email,
            'role': role,
            'org': org
        }

        token = create_token(user)

        return jsonify({
            'user': user,
            'token': token
        })

    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json

        email = data.get('email')
        password = data.get('password')

        db = get_db()

        row = db.execute(
            'SELECT * FROM users WHERE email=?',
            (email,)
        ).fetchone()

        if not row:
            return jsonify({'error': 'Invalid credentials'}), 401

        if not check_password(password, row['password']):
            return jsonify({'error': 'Invalid credentials'}), 401

        user = {
            'id': row['id'],
            'name': row['name'],
            'email': row['email'],
            'role': row['role'],
            'org': row['org']
        }

        token = create_token(user)

        return jsonify({
            'user': user,
            'token': token
        })

    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

# ─────────────────────────────────────────────────────────────
# Files
# ─────────────────────────────────────────────────────────────

@app.route('/api/files/upload', methods=['POST'])
@require_auth
def upload_files():
    try:

        db = get_db()
        results = []

        is_shared = request.form.get('isShared') == 'true'

        for file in request.files.getlist('files'):

            ext = os.path.splitext(file.filename)[1].lower()

            if ext not in ALLOWED_EXT:
                continue

            filename = str(uuid.uuid4()) + ext
            filepath = os.path.join(UPLOAD_DIR, filename)

            file.save(filepath)

            content = extract_text(filepath, file.filename)

            fid = str(uuid.uuid4())

            db.execute(
                '''
                INSERT INTO files
                (id,user_id,org,name,original,mime_type,size,content,is_shared)
                VALUES (?,?,?,?,?,?,?,?,?)
                ''',
                (
                    fid,
                    request.user['id'],
                    request.user['org'],
                    filename,
                    file.filename,
                    file.content_type or '',
                    os.path.getsize(filepath),
                    content,
                    1 if is_shared else 0
                )
            )

            results.append({
                'id': fid,
                'name': file.filename,
                'size': os.path.getsize(filepath),
                'parsed': bool(content),
                'charCount': len(content) if content else 0
            })

        db.commit()

        return jsonify({
            'files': results
        })

    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/files', methods=['GET'])
@require_auth
def get_files():

    db = get_db()

    rows = db.execute(
        '''
        SELECT * FROM files
        WHERE user_id=? OR (org=? AND is_shared=1)
        ORDER BY uploaded_at DESC
        ''',
        (request.user['id'], request.user['org'])
    ).fetchall()

    return jsonify({
        'files': [dict(r) for r in rows]
    })

# ─────────────────────────────────────────────────────────────
# AI Context
# ─────────────────────────────────────────────────────────────

def get_user_context(user_id, org):

    db = get_db()

    rows = db.execute(
        '''
        SELECT original, content FROM files
        WHERE (user_id=? OR (org=? AND is_shared=1))
        AND content IS NOT NULL
        ''',
        (user_id, org)
    ).fetchall()

    if not rows:
        return None

    return '\n\n'.join(
        f"=== {r['original']} ===\n{r['content'][:3000]}"
        for r in rows
    )

# ─────────────────────────────────────────────────────────────
# AI Helper
# ─────────────────────────────────────────────────────────────

def call_ai(system, messages, max_tokens=1000):

    combined = system + "\n\n"

    for msg in messages:
        combined += f"{msg['role']}: {msg['content']}\n"

    completion = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "user",
                "content": combined
            }
        ],
        temperature=0.7,
        max_tokens=max_tokens
    )

    return completion.choices[0].message.content

# ─────────────────────────────────────────────────────────────
# Chat
# ─────────────────────────────────────────────────────────────

@app.route('/api/ai/chat', methods=['POST'])
@require_auth
def chat():

    try:

        db = get_db()

        data = request.json
        message = data.get('message')

        if not message:
            return jsonify({'error': 'Message required'}), 400

        context = get_user_context(
            request.user['id'],
            request.user['org']
        )

        system = (
            f"You are StudyBuddy AI.\n\nStudy Materials:\n{context}"
            if context else
            "You are StudyBuddy AI."
        )

        reply = call_ai(
            system,
            [{'role': 'user', 'content': message}],
            1000
        )

        db.execute(
            '''
            INSERT INTO chat_messages
            (id,user_id,role,content)
            VALUES (?,?,?,?)
            ''',
            (
                str(uuid.uuid4()),
                request.user['id'],
                'user',
                message
            )
        )

        db.execute(
            '''
            INSERT INTO chat_messages
            (id,user_id,role,content)
            VALUES (?,?,?,?)
            ''',
            (
                str(uuid.uuid4()),
                request.user['id'],
                'assistant',
                reply
            )
        )

        db.commit()

        return jsonify({
            'reply': reply
        })

    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

# ─────────────────────────────────────────────────────────────
# Quiz
# ─────────────────────────────────────────────────────────────

@app.route('/api/ai/quiz', methods=['POST'])
@require_auth
def generate_quiz():

    try:

        data = request.json

        topic = data.get('topic')
        count = data.get('count', 5)

        if not topic:
            return jsonify({'error': 'Topic required'}), 400

        context = get_user_context(
            request.user['id'],
            request.user['org']
        )

        system = f'''
Generate exactly {count} MCQs.

Return ONLY valid JSON array format:

[
 {{
   "q":"Question",
   "opts":["A","B","C","D"],
   "ans":0,
   "explanation":"Explanation"
 }}
]
'''

        if context:
            system += f"\n\nStudy Materials:\n{context}"

        raw = call_ai(
            system,
            [{'role': 'user', 'content': f'Generate MCQs on {topic}'}],
            1500
        )

        cleaned = raw.replace('```json', '').replace('```', '').strip()

        start = cleaned.find('[')
        end = cleaned.rfind(']') + 1

        questions = json.loads(cleaned[start:end])

        return jsonify({
            'questions': questions,
            'topic': topic
        })

    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

# ─────────────────────────────────────────────────────────────
# Notes
# ─────────────────────────────────────────────────────────────

@app.route('/api/ai/notes', methods=['POST'])
@require_auth
def generate_notes():

    try:

        topic = request.json.get('topic')

        if not topic:
            return jsonify({'error': 'Topic required'}), 400

        context = get_user_context(
            request.user['id'],
            request.user['org']
        )

        system = '''
Generate study notes.

Return ONLY JSON:

{
 "title":"",
 "summary":"",
 "keyPoints":[],
 "importantTerms":[
   {
     "term":"",
     "def":""
   }
 ],
 "examTips":[]
}
'''

        if context:
            system += f"\n\nStudy Materials:\n{context}"

        raw = call_ai(
            system,
            [{'role': 'user', 'content': f'Notes on {topic}'}],
            1500
        )

        cleaned = raw.replace('```json', '').replace('```', '').strip()

        content = json.loads(cleaned)

        return jsonify(content)

    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

# ─────────────────────────────────────────────────────────────
# Summarize
# ─────────────────────────────────────────────────────────────

@app.route('/api/ai/summarize', methods=['POST'])
@require_auth
def summarize():

    try:

        context = get_user_context(
            request.user['id'],
            request.user['org']
        )

        if not context:
            return jsonify({'error': 'No files uploaded'}), 400

        summary = call_ai(
            'Summarize these study materials clearly.',
            [{'role': 'user', 'content': context}],
            1200
        )

        return jsonify({
            'summary': summary
        })

    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

# ─────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────

if __name__ == '__main__':

    init_db()

    port = int(os.getenv('PORT', 5000))

    print(f'\n🎓 StudyBuddy running at http://localhost:{port}\n')

    app.run(
        debug=True,
        port=port
    )