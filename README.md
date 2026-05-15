# 🎓 StudyBuddy — Python Edition

AI-powered academic platform built with **Python Flask + HTML/CSS/JS + SQLite**.

---

## 🗂 Project Structure

```
studybuddy-python/
├── app.py              # Flask backend — all routes
├── db.py               # SQLite database setup & schema
├── auth.py             # JWT auth & bcrypt password hashing
├── parser.py           # PDF, DOCX, TXT text extraction
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variables template
├── data/               # SQLite database file (auto-created)
├── uploads/            # Uploaded files (auto-created)
├── templates/
│   └── index.html      # Single HTML entry point
└── static/
    ├── css/
    │   └── style.css   # All styles
    └── js/
        ├── api.js       # All API calls
        ├── auth.js      # Signup & Login pages
        ├── dashboard.js # Layout, sidebar, home
        ├── pages.js     # All feature pages
        └── app.js       # Entry point / router
```

---

## ⚡ Quick Start

### 1. Install Python
Download from **https://python.org** (version 3.9+). During install check ✅ **"Add Python to PATH"**.

### 2. Create virtual environment (recommended)
```bash
cd studybuddy-python
python -m venv venv

# Activate on Windows:
venv\Scripts\activate

# Activate on Mac/Linux:
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up environment variables
```bash
# Windows:
copy .env.example .env

# Mac/Linux:
cp .env.example .env
```
Open `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```
Get your key at: **https://console.anthropic.com**

### 5. Run the app
```bash
python app.py
```

### 6. Open in browser
Visit **http://localhost:5000** 🎓

---

## 🔑 All API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login → JWT token |
| POST | `/api/files/upload` | Upload files (multipart) |
| GET | `/api/files` | List files |
| DELETE | `/api/files/<id>` | Delete file |
| GET | `/api/files/context` | Get parsed text context |
| POST | `/api/ai/chat` | AI chat message |
| GET | `/api/ai/chat/history` | Chat history |
| DELETE | `/api/ai/chat/history` | Clear chat |
| POST | `/api/ai/quiz` | Generate quiz |
| POST | `/api/ai/quiz/save` | Save quiz result |
| GET | `/api/ai/quiz/results` | Past results |
| POST | `/api/ai/notes` | Generate notes |
| GET | `/api/ai/notes` | Saved notes |
| DELETE | `/api/ai/notes/<id>` | Delete note |
| POST | `/api/ai/questions` | Generate questions |
| GET | `/api/ai/questions` | Saved questions |
| POST | `/api/ai/summarize` | Summarize all files |
| GET | `/api/users/me` | Current user |
| GET | `/api/users/org` | Org members |
| GET | `/api/users/progress` | Progress stats |
| GET | `/api/users/routine` | Study routine |
| POST | `/api/users/routine` | Save routine slot |
| DELETE | `/api/users/routine` | Remove routine slot |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.9+, Flask 3.0 |
| Database | SQLite (built into Python) |
| Auth | PyJWT + bcrypt |
| PDF Parsing | PyMuPDF (fitz) |
| DOCX Parsing | python-docx |
| AI | Anthropic Claude API |
| Frontend | Vanilla HTML + CSS + JavaScript |

---

## 🪟 Windows Tips

- Use **Command Prompt** or **PowerShell** (not Git Bash) for Python commands
- If `python` not found, try `py` instead
- If pip install fails, run as Administrator
- Virtual environment activation: `venv\Scripts\activate`
