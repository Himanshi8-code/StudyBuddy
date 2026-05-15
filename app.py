# app.py — StudyBuddy Flask Backend
import os, json, uuid, time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

load_dotenv()

from db import get_db, init_db
from auth import hash_password, check_password, create_token, require_auth
from parser import extract_text

import requests as http_requests

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app, origins=[os.getenv('FRONTEND_URL', 'http://localhost:5000')], supports_credentials=True)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

CLAUDE_API = 'https://api.anthropic.com/v1/messages'
MODEL = 'claude-sonnet-4-20250514'
ALLOWED_EXT = {'.pdf', '.docx', '.txt', '.md'}

# ─── Serve Frontend ──────────────────────────────────────────────────────────
@app.route('/')
@app.route('/<path:path>')
def serve_frontend(path=''):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.template_folder, 'index.html')

# ─── Health ──────────────────────────────────────────────────────────────────
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'version': '1.0.0'})

# ─── AUTH ────────────────────────────────────────────────────────────────────
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        name, email, password, role, org = data.get('name'), data.get('email'), data.get('password'), data.get('role'), data.get('org')
        if not all([name, email, password, role, org]):
            return jsonify({'error': 'All fields are required'}), 400

        db = get_db()
        if db.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone():
            return jsonify({'error': 'Email already registered'}), 409

        uid = str(uuid.uuid4())
        hashed = hash_password(password)
        db.execute('INSERT INTO users (id,name,email,password,role,org) VALUES (?,?,?,?,?,?)',
                   (uid, name, email, hashed, role, org))
        db.commit()

        user = {'id': uid, 'name': name, 'email': email, 'role': role, 'org': org}
        token = create_token(dict(user))
        return jsonify({'user': user, 'token': token}), 201
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        email, password = data.get('email'), data.get('password')
        db = get_db()
        row = db.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
        if not row or not check_password(password, row['password']):
            return jsonify({'error': 'Invalid credentials'}), 401

        user = {'id': row['id'], 'name': row['name'], 'email': row['email'], 'role': row['role'], 'org': row['org']}
        token = create_token(dict(user))
        return jsonify({'user': user, 'token': token})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── FILES ────────────────────────────────────────────────────────────────────
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
            fname = str(uuid.uuid4()) + ext
            fpath = os.path.join(UPLOAD_DIR, fname)
            file.save(fpath)
            content = extract_text(fpath, file.filename)
            fid = str(uuid.uuid4())
            db.execute('INSERT INTO files (id,user_id,org,name,original,mime_type,size,content,is_shared) VALUES (?,?,?,?,?,?,?,?,?)',
                       (fid, request.user['id'], request.user['org'], fname, file.filename,
                        file.content_type or '', os.path.getsize(fpath), content, 1 if is_shared else 0))
            results.append({'id': fid, 'name': file.filename, 'size': os.path.getsize(fpath),
                            'parsed': bool(content), 'charCount': len(content) if content else 0})
        db.commit()
        return jsonify({'files': results}), 201
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/files', methods=['GET'])
@require_auth
def list_files():
    db = get_db()
    rows = db.execute('''
        SELECT f.id, f.name, f.original, f.size, f.is_shared, f.uploaded_at,
               u.name as uploader_name, u.role as uploader_role,
               CASE WHEN f.content IS NOT NULL THEN 1 ELSE 0 END as has_content,
               CASE WHEN f.content IS NOT NULL THEN LENGTH(f.content) ELSE 0 END as char_count
        FROM files f JOIN users u ON u.id=f.user_id
        WHERE f.user_id=? OR (f.org=? AND f.is_shared=1)
        ORDER BY f.uploaded_at DESC
    ''', (request.user['id'], request.user['org'])).fetchall()
    return jsonify({'files': [dict(r) for r in rows]})

@app.route('/api/files/<fid>', methods=['DELETE'])
@require_auth
def delete_file(fid):
    db = get_db()
    row = db.execute('SELECT * FROM files WHERE id=? AND user_id=?', (fid, request.user['id'])).fetchone()
    if not row:
        return jsonify({'error': 'File not found'}), 404
    fp = os.path.join(UPLOAD_DIR, row['name'])
    if os.path.exists(fp):
        os.remove(fp)
    db.execute('DELETE FROM files WHERE id=?', (fid,))
    db.commit()
    return jsonify({'success': True})

@app.route('/api/files/context', methods=['GET'])
@require_auth
def file_context():
    db = get_db()
    rows = db.execute('''
        SELECT original, content FROM files
        WHERE (user_id=? OR (org=? AND is_shared=1)) AND content IS NOT NULL AND content!=''
    ''', (request.user['id'], request.user['org'])).fetchall()
    context = '\n\n'.join(f"=== {r['original']} ===\n{r['content'][:4000]}" for r in rows)
    return jsonify({'context': context, 'fileCount': len(rows)})

# ─── AI HELPERS ──────────────────────────────────────────────────────────────
def get_user_context(user_id, org):
    db = get_db()
    rows = db.execute('''
        SELECT original, content FROM files
        WHERE (user_id=? OR (org=? AND is_shared=1)) AND content IS NOT NULL AND content!=''
    ''', (user_id, org)).fetchall()
    if not rows:
        return None
    return '\n\n---\n\n'.join(f"=== {r['original']} ===\n{r['content'][:3000]}" for r in rows)

def call_claude(system, messages, max_tokens=1000):
    api_key = os.getenv('ANTHROPIC_API_KEY', '')
    resp = http_requests.post(CLAUDE_API, json={
        'model': MODEL, 'max_tokens': max_tokens,
        'system': system, 'messages': messages
    }, headers={
        'Content-Type': 'application/json',
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01'
    })
    data = resp.json()
    if 'error' in data:
        raise Exception(data['error']['message'])
    return ''.join(c.get('text', '') for c in data.get('content', []))

# ─── CHAT ────────────────────────────────────────────────────────────────────
@app.route('/api/ai/chat', methods=['POST'])
@require_auth
def chat():
    try:
        db = get_db()
        message = request.json.get('message')
        if not message:
            return jsonify({'error': 'Message required'}), 400

        context = get_user_context(request.user['id'], request.user['org'])
        history = db.execute('SELECT role,content FROM chat_messages WHERE user_id=? ORDER BY created_at DESC LIMIT 20',
                             (request.user['id'],)).fetchall()
        history = list(reversed(history))

        system = (f"You are StudyBuddy AI for {request.user['org']}. Answer ONLY from these study materials:\n\n{context}"
                  if context else f"You are StudyBuddy AI for {request.user['org']}. No materials uploaded yet.")

        messages = [{'role': r['role'], 'content': r['content']} for r in history]
        messages.append({'role': 'user', 'content': message})

        reply = call_claude(system, messages)
        mid = str(uuid.uuid4())
        db.execute('INSERT INTO chat_messages (id,user_id,role,content) VALUES (?,?,?,?)',
                   (str(uuid.uuid4()), request.user['id'], 'user', message))
        db.execute('INSERT INTO chat_messages (id,user_id,role,content) VALUES (?,?,?,?)',
                   (mid, request.user['id'], 'assistant', reply))
        db.commit()
        return jsonify({'reply': reply})
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/chat/history', methods=['GET'])
@require_auth
def chat_history():
    db = get_db()
    rows = db.execute('SELECT role,content,created_at FROM chat_messages WHERE user_id=? ORDER BY created_at ASC LIMIT 100',
                      (request.user['id'],)).fetchall()
    return jsonify({'messages': [dict(r) for r in rows]})

@app.route('/api/ai/chat/history', methods=['DELETE'])
@require_auth
def clear_chat():
    db = get_db()
    db.execute('DELETE FROM chat_messages WHERE user_id=?', (request.user['id'],))
    db.commit()
    return jsonify({'success': True})

# ─── QUIZ ────────────────────────────────────────────────────────────────────
@app.route('/api/ai/quiz', methods=['POST'])
@require_auth
def generate_quiz():
    try:
        data = request.json
        topic, count = data.get('topic'), data.get('count', 5)
        if not topic:
            return jsonify({'error': 'Topic required'}), 400
        context = get_user_context(request.user['id'], request.user['org'])
        system = f'Generate exactly {count} MCQs. Return ONLY a JSON array:\n[{{"q":"","opts":["A","B","C","D"],"ans":0,"explanation":""}}]\n'
        if context:
            system += f'Base on:\n{context}'
        raw = call_claude(system, [{'role': 'user', 'content': f'MCQs on: {topic}'}], 1500)
        questions = json.loads(raw.replace('```json', '').replace('```', '').strip())
        return jsonify({'questions': questions, 'topic': topic})
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/quiz/save', methods=['POST'])
@require_auth
def save_quiz():
    db = get_db()
    data = request.json
    db.execute('INSERT INTO quiz_results (id,user_id,topic,score,total) VALUES (?,?,?,?,?)',
               (str(uuid.uuid4()), request.user['id'], data['topic'], data['score'], data['total']))
    db.commit()
    return jsonify({'success': True})

@app.route('/api/ai/quiz/results', methods=['GET'])
@require_auth
def quiz_results():
    db = get_db()
    rows = db.execute('SELECT topic,score,total,taken_at FROM quiz_results WHERE user_id=? ORDER BY taken_at DESC LIMIT 20',
                      (request.user['id'],)).fetchall()
    return jsonify({'results': [dict(r) for r in rows]})

# ─── NOTES ───────────────────────────────────────────────────────────────────
@app.route('/api/ai/notes', methods=['POST'])
@require_auth
def generate_notes():
    try:
        db = get_db()
        topic = request.json.get('topic')
        if not topic:
            return jsonify({'error': 'Topic required'}), 400
        context = get_user_context(request.user['id'], request.user['org'])
        system = 'Generate study notes. Return ONLY JSON:\n{"title":"","summary":"","keyPoints":[],"importantTerms":[{"term":"","def":""}],"examTips":[]}\n'
        if context:
            system += f'Base on:\n{context}'
        raw = call_claude(system, [{'role': 'user', 'content': f'Notes on: {topic}'}], 1500)
        content = json.loads(raw.replace('```json', '').replace('```', '').strip())
        nid = str(uuid.uuid4())
        db.execute('INSERT INTO notes (id,user_id,topic,content) VALUES (?,?,?,?)',
                   (nid, request.user['id'], topic, json.dumps(content)))
        db.commit()
        return jsonify({'id': nid, 'topic': topic, **content})
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/notes', methods=['GET'])
@require_auth
def get_notes():
    db = get_db()
    rows = db.execute('SELECT id,topic,content,created_at FROM notes WHERE user_id=? ORDER BY created_at DESC',
                      (request.user['id'],)).fetchall()
    return jsonify({'notes': [{'id': r['id'], 'topic': r['topic'], 'created_at': r['created_at'],
                               'content': json.loads(r['content'])} for r in rows]})

@app.route('/api/ai/notes/<nid>', methods=['DELETE'])
@require_auth
def delete_note(nid):
    db = get_db()
    db.execute('DELETE FROM notes WHERE id=? AND user_id=?', (nid, request.user['id']))
    db.commit()
    return jsonify({'success': True})

# ─── QUESTIONS ────────────────────────────────────────────────────────────────
@app.route('/api/ai/questions', methods=['POST'])
@require_auth
def generate_questions():
    try:
        db = get_db()
        topic = request.json.get('topic')
        if not topic:
            return jsonify({'error': 'Topic required'}), 400
        context = get_user_context(request.user['id'], request.user['org'])
        system = 'Generate 10 exam questions. Return ONLY JSON array:\n[{"question":"","type":"short_answer","difficulty":"easy"}]\n'
        if context:
            system += f'Base on:\n{context}'
        raw = call_claude(system, [{'role': 'user', 'content': f'Questions on: {topic}'}], 1200)
        questions = json.loads(raw.replace('```json', '').replace('```', '').strip())
        qid = str(uuid.uuid4())
        db.execute('INSERT INTO generated_questions (id,user_id,topic,questions) VALUES (?,?,?,?)',
                   (qid, request.user['id'], topic, json.dumps(questions)))
        db.commit()
        return jsonify({'id': qid, 'topic': topic, 'questions': questions})
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/questions', methods=['GET'])
@require_auth
def get_questions():
    db = get_db()
    rows = db.execute('SELECT id,topic,questions,created_at FROM generated_questions WHERE user_id=? ORDER BY created_at DESC',
                      (request.user['id'],)).fetchall()
    return jsonify({'questions': [{'id': r['id'], 'topic': r['topic'], 'created_at': r['created_at'],
                                   'questions': json.loads(r['questions'])} for r in rows]})

@app.route('/api/ai/summarize', methods=['POST'])
@require_auth
def summarize():
    try:
        context = get_user_context(request.user['id'], request.user['org'])
        if not context:
            return jsonify({'error': 'No files uploaded'}), 400
        summary = call_claude('Summarize these study materials clearly.', [{'role': 'user', 'content': context}], 1500)
        return jsonify({'summary': summary})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── USERS ────────────────────────────────────────────────────────────────────
@app.route('/api/users/me', methods=['GET'])
@require_auth
def get_me():
    db = get_db()
    row = db.execute('SELECT id,name,email,role,org,created_at FROM users WHERE id=?',
                     (request.user['id'],)).fetchone()
    return jsonify({'user': dict(row)}) if row else jsonify({'error': 'Not found'}), 404

@app.route('/api/users/org', methods=['GET'])
@require_auth
def org_users():
    db = get_db()
    rows = db.execute('SELECT id,name,role,org FROM users WHERE org=? AND id!=? ORDER BY role DESC, name ASC',
                      (request.user['org'], request.user['id'])).fetchall()
    return jsonify({'users': [dict(r) for r in rows]})

@app.route('/api/users/progress', methods=['GET'])
@require_auth
def progress():
    db = get_db()
    uid = request.user['id']
    quiz_rows = db.execute('SELECT topic,score,total,taken_at FROM quiz_results WHERE user_id=? ORDER BY taken_at DESC LIMIT 10', (uid,)).fetchall()
    file_count = db.execute('SELECT COUNT(*) FROM files WHERE user_id=?', (uid,)).fetchone()[0]
    note_count = db.execute('SELECT COUNT(*) FROM notes WHERE user_id=?', (uid,)).fetchone()[0]
    chat_count = db.execute("SELECT COUNT(*) FROM chat_messages WHERE user_id=? AND role='user'", (uid,)).fetchone()[0]
    avg = round(sum(r['score']/r['total']*100 for r in quiz_rows)/len(quiz_rows)) if quiz_rows else 0
    return jsonify({'fileCount': file_count, 'noteCount': note_count, 'quizCount': len(quiz_rows),
                    'chatCount': chat_count, 'avgScore': avg, 'quizResults': [dict(r) for r in quiz_rows]})

@app.route('/api/users/routine', methods=['GET'])
@require_auth
def get_routine():
    db = get_db()
    rows = db.execute('SELECT * FROM study_sessions WHERE user_id=?', (request.user['id'],)).fetchall()
    return jsonify({'sessions': [dict(r) for r in rows]})

@app.route('/api/users/routine', methods=['POST'])
@require_auth
def save_routine():
    db = get_db()
    data = request.json
    day, slot, subject = data.get('day'), data.get('slot'), data.get('subject')
    if not all([day, slot, subject]):
        return jsonify({'error': 'day, slot, subject required'}), 400
    existing = db.execute('SELECT id FROM study_sessions WHERE user_id=? AND day=? AND slot=?',
                          (request.user['id'], day, slot)).fetchone()
    if existing:
        db.execute('UPDATE study_sessions SET subject=? WHERE id=?', (subject, existing['id']))
    else:
        db.execute('INSERT INTO study_sessions (id,user_id,subject,day,slot) VALUES (?,?,?,?,?)',
                   (str(uuid.uuid4()), request.user['id'], subject, day, slot))
    db.commit()
    return jsonify({'success': True})

@app.route('/api/users/routine', methods=['DELETE'])
@require_auth
def delete_routine():
    db = get_db()
    data = request.json
    db.execute('DELETE FROM study_sessions WHERE user_id=? AND day=? AND slot=?',
               (request.user['id'], data.get('day'), data.get('slot')))
    db.commit()
    return jsonify({'success': True})

# ─── Run ─────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    port = int(os.getenv('PORT', 5000))
    print(f'\n🎓 StudyBuddy running at http://localhost:{port}\n')
    app.run(debug=True, port=port)
