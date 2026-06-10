# Anthropic API key troubleshooting (StudyBuddy)

## Symptom
Backend calls to `/api/ai/*` fail with an “API key” error.

## Root cause (most common)
`app.py` reads the key from environment variables:
- `ANTHROPIC_API_KEY` (preferred)
- or `API_KEY` (fallback)

In the current environment, both values are `None` (missing), so the request is sent with an empty key.

## Fix
1. Create a real `.env` file in the project root.
   - Copy from `.env.example`:
     - `cp .env.example .env` (mac/linux)
     - or copy manually / on Windows
2. Edit `.env` and set:
   ```
   ANTHROPIC_API_KEY=sk-your_actual_key_here
   ```
3. Restart the Flask app so `load_dotenv()` re-reads the file.

## Quick verification
Run this while the server is stopped:
```bash
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('ANTHROPIC_API_KEY=', bool(os.getenv('ANTHROPIC_API_KEY')))" 
```
It should print `True`.

