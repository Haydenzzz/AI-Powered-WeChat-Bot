import os
from flask import Flask, request, jsonify, g
import sqlite3
from dotenv import load_dotenv
from 爬取文章 import get_latest_8point1kr_article
import logging
from datetime import datetime

# 获取当前文件的目录
current_dir = os.path.dirname(os.path.abspath(__file__))
# 获取上一级目录（项目根目录）
parent_dir = os.path.dirname(current_dir)
# 构造 .env 文件的路径
dotenv_path = os.path.join(parent_dir, 'config', '.env')

# 加载 .env 文件
load_dotenv(dotenv_path)

app = Flask(__name__)

DATABASE = 'chat_history.db'

# 从环境变量中获取配置的群聊和好友列表
ALLOWED_ROOMS = [room.strip() for room in os.getenv('ROOM_WHITELIST', '').split(',') if room.strip()]
ALLOWED_CONTACTS = [contact.strip() for contact in os.getenv('ALIAS_WHITELIST', '').split(',') if contact.strip()]

print(f"Loaded ALLOWED_ROOMS: {ALLOWED_ROOMS}")
print(f"Loaded ALLOWED_CONTACTS: {ALLOWED_CONTACTS}")


# 设置日志
logging.basicConfig(level=logging.DEBUG)

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''CREATE TABLE IF NOT EXISTS chat_history
                      (id INTEGER PRIMARY KEY AUTOINCREMENT,
                       chat_id TEXT,
                       role TEXT,
                       content TEXT,
                       timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
        db.execute('''CREATE TABLE IF NOT EXISTS reminders
                      (id INTEGER PRIMARY KEY AUTOINCREMENT,
                       chat_id TEXT,
                       content TEXT,
                       remind_time DATETIME,
                       user_name TEXT,
                       is_completed BOOLEAN DEFAULT FALSE)''')
        db.execute('''CREATE TABLE IF NOT EXISTS accounts
                      (id INTEGER PRIMARY KEY AUTOINCREMENT,
                       chat_id TEXT,
                       user_name TEXT,
                       account_name TEXT,
                       balance REAL,
                       timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
        db.commit()
    print("Database initialized successfully")

def is_allowed_chat(chat_id):
    print(f"Checking if chat_id '{chat_id}' is allowed")
    if chat_id.startswith('room_'):
        room_name = chat_id[5:]
        is_allowed = room_name in ALLOWED_ROOMS
        print(f"Room '{room_name}' is {'allowed' if is_allowed else 'not allowed'}")
        return is_allowed
    elif chat_id.startswith('user_'):
        user_name = chat_id[5:]
        is_allowed = user_name in ALLOWED_CONTACTS
        print(f"User '{user_name}' is {'allowed' if is_allowed else 'not allowed'}")
        return is_allowed
    print(f"Chat_id '{chat_id}' does not start with 'room_' or 'user_'")
    return False

@app.route('/api/chat_history', methods=['POST'])
def save_message():
    data = request.json
    print(f"Received save message request: {data}")
    if 'chat_id' not in data:
        print("Error: chat_id not found in request data")
        return jsonify({"status": "error", "message": "chat_id is required"}), 400
    if not is_allowed_chat(data['chat_id']):
        print(f"Chat {data['chat_id']} not in whitelist")
        return jsonify({"status": "ignored", "message": "Chat not in whitelist"}), 200
    
    db = get_db()
    db.execute('INSERT INTO chat_history (chat_id, role, content) VALUES (?, ?, ?)',
                [data['chat_id'], data['role'], data['content']])
    db.commit()
    print(f"Message saved successfully for chat_id: {data['chat_id']}")
    return jsonify({"status": "success"}), 200

@app.route('/api/chat_history/<chat_id>', methods=['GET'])
def get_messages(chat_id):
    print(f"Received get messages request for chat_id: {chat_id}")
    if not is_allowed_chat(chat_id):
        print(f"Chat {chat_id} not in whitelist")
        return jsonify([]), 200
    
    db = get_db()
    messages = db.execute('SELECT role, content FROM chat_history WHERE chat_id = ? ORDER BY timestamp DESC LIMIT 10',
                          [chat_id]).fetchall()
    print(f"Retrieved {len(messages)} messages for chat_id: {chat_id}")
    return jsonify([dict(msg) for msg in messages][::-1]), 200

@app.route('/api/latest-article', methods=['GET'])
def get_latest_article():
    try:
        article = get_latest_8point1kr_article()
        if article:
            logging.info(f"Successfully retrieved article: {article}")
            return jsonify(article), 200
        else:
            logging.warning("No article retrieved")
            return jsonify({"error": "无法获取最新文章"}), 404
    except Exception as e:
        logging.error(f"Error retrieving article: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/reminders', methods=['POST'])
def save_reminder():
    try:
        data = request.json
        print(f"Received reminder data: {data}")
        if not all(key in data for key in ['chat_id', 'content', 'remind_time', 'user_name']):
            raise ValueError("Missing required fields in reminder data")
        db = get_db()
        db.execute('INSERT INTO reminders (chat_id, content, remind_time, user_name) VALUES (?, ?, ?, ?)',
                    [data['chat_id'], data['content'], data['remind_time'], data['user_name']])
        db.commit()
        print(f"Reminder saved successfully: {data}")
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error saving reminder: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/reminders/check', methods=['GET'])
def check_reminders():
    db = get_db()
    current_time = datetime.now().isoformat()
    reminders = db.execute('SELECT * FROM reminders WHERE remind_time <= ? AND is_completed = FALSE', [current_time]).fetchall()
    reminders_list = [dict(reminder) for reminder in reminders]
    print(f"Checking reminders. Found {len(reminders_list)} reminders to process.")
    return jsonify(reminders_list), 200

@app.route('/api/reminders/complete', methods=['POST'])
def complete_reminder():
    data = request.json
    db = get_db()
    db.execute('UPDATE reminders SET is_completed = TRUE WHERE id = ?', [data['id']])
    db.commit()
    print(f"Marked reminder {data['id']} as completed.")
    return jsonify({"status": "success"}), 200

@app.route('/api/accounts', methods=['POST'])
def save_account():
    try:
        data = request.json
        db = get_db()
        db.execute('INSERT INTO accounts (chat_id, user_name, account_name, balance) VALUES (?, ?, ?, ?)',
                    [data['chat_id'], data['user_name'], data['account_name'], data['balance']])
        db.commit()
        print(f"Account saved successfully: {data}")
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error saving account: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/accounts/net-worth', methods=['GET'])
def get_net_worth():
    try:
        chat_id = request.args.get('chat_id')
        user_name = request.args.get('user_name')
        db = get_db()
        total = db.execute('SELECT SUM(balance) FROM accounts WHERE chat_id = ? AND user_name = ?', [chat_id, user_name]).fetchone()[0] or 0
        print(f"Net worth for {chat_id}, {user_name}: {total}")
        return jsonify({"net_worth": total}), 200
    except Exception as e:
        print(f"Error getting net worth: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/accounts/latest-balances', methods=['GET'])
def get_latest_account_balances():
    try:
        chat_id = request.args.get('chat_id')
        user_name = request.args.get('user_name')
        db = get_db()
        balances = db.execute('''
            SELECT account_name, balance
            FROM accounts
            WHERE chat_id = ? AND user_name = ?
            GROUP BY account_name
            HAVING MAX(timestamp)
        ''', [chat_id, user_name]).fetchall()
        balances_list = [dict(balance) for balance in balances]
        print(f"Latest account balances for {chat_id}, {user_name}: {balances_list}")
        return jsonify({"balances": balances_list}), 200
    except Exception as e:
        print(f"Error getting latest account balances: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def check_and_update_db_structure():
    with app.app_context():
        db = get_db()
        try:
            db.execute('SELECT user_name FROM reminders LIMIT 1')
        except sqlite3.OperationalError:
            print("Adding user_name column to reminders table")
            db.execute('ALTER TABLE reminders ADD COLUMN user_name TEXT')
            db.commit()
        print("Database structure checked and updated if necessary")

# 在主程序部分调用此函数
if __name__ == '__main__':
    init_db()
    check_and_update_db_structure()
    app.run(debug=True, port=5000)