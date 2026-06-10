# db.py — SQLite database setup
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'studybuddy.db')
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            email       TEXT UNIQUE NOT NULL,
            password    TEXT NOT NULL,
            role        TEXT NOT NULL CHECK(role IN ('student','mentor')),
            org         TEXT NOT NULL,
            created_at  INTEGER DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS files (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            org         TEXT NOT NULL,
            name        TEXT NOT NULL,
            original    TEXT NOT NULL,
            mime_type   TEXT NOT NULL,
            size        INTEGER NOT NULL,
            content     TEXT,
            is_shared   INTEGER DEFAULT 0,
            uploaded_at INTEGER DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS quiz_results (
            id        TEXT PRIMARY KEY,
            user_id   TEXT NOT NULL,
            topic     TEXT NOT NULL,
            score     INTEGER NOT NULL,
            total     INTEGER NOT NULL,
            taken_at  INTEGER DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS notes (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            topic      TEXT NOT NULL,
            content    TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS study_sessions (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            subject    TEXT NOT NULL,
            day        TEXT NOT NULL,
            slot       TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            UNIQUE(user_id, day, slot)
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            role       TEXT NOT NULL CHECK(role IN ('user','assistant')),
            content    TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS generated_questions (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            topic      TEXT NOT NULL,
            questions  TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s','now'))
        );
    ''')
    conn.commit()
    conn.close()
    print("✅ Database initialized (SQLite)")
