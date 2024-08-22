import sqlite3
from flask import g

DATABASE = 'chat_history.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

def close_db(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with sqlite3.connect(DATABASE) as db:
        db.execute('''CREATE TABLE IF NOT EXISTS chat_history
                      (id INTEGER PRIMARY KEY AUTOINCREMENT,
                       chat_id TEXT,
                       role TEXT,
                       content TEXT,
                       timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')

def save_message(chat_id, role, content):
    db = get_db()
    db.execute('INSERT INTO chat_history (chat_id, role, content) VALUES (?, ?, ?)',
                [chat_id, role, content])
    db.commit()

def get_recent_messages(chat_id, limit=10):
    db = get_db()
    messages = db.execute('SELECT role, content FROM chat_history WHERE chat_id = ? ORDER BY timestamp DESC LIMIT ?',
                          [chat_id, limit]).fetchall()
    return [dict(msg) for msg in messages]