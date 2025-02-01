import requests
import time
import json
import html
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all domains

BASE_URL = "http://api.guerrillamail.com/ajax.php"

# Helper functions
def get_email_address(session):
    params = {'f': 'get_email_address'}
    response = session.get(BASE_URL, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()
    return data.get("email_addr", ""), data.get("sid_token", "")

def check_email(session, sid_token, seq):
    params = {'f': 'check_email', 'sid_token': sid_token, 'seq': seq}
    response = session.get(BASE_URL, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()
    return data.get("list", []), data.get("seq", seq)

def fetch_email(session, mail_id, sid_token):
    params = {'f': 'fetch_email', 'email_id': mail_id, 'sid_token': sid_token}
    response = session.get(BASE_URL, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()
    return html.unescape(data.get('mail_body', 'No content'))

# API Endpoints
@app.route('/generate_email', methods=['GET'])
def generate_email():
    session = requests.Session()
    email_address, sid_token = get_email_address(session)

    if email_address:
        return jsonify({"email": email_address, "sid_token": sid_token}), 200
    else:
        return jsonify({"error": "Failed to generate email. Please try again."}), 500

@app.route('/check_messages', methods=['POST'])
def check_messages():
    data = request.get_json()
    sid_token = data.get('sid_token')
    seq = data.get('seq', 0)

    if not sid_token:
        return jsonify({"error": "sid_token is required"}), 400

    session = requests.Session()
    messages, seq = check_email(session, sid_token, seq)

    message_list = []
    if messages:
        for msg in messages:
            mail_id = msg.get('mail_id')
            mail_from = msg.get('mail_from', 'Unknown')
            mail_subject = msg.get('mail_subject', 'No Subject')

            mail_content = fetch_email(session, mail_id, sid_token)
            message_list.append({
                "from": mail_from,
                "subject": mail_subject,
                "content": mail_content
            })

    return jsonify({"messages": message_list, "seq": seq}), 200

if __name__ == "__main__":
    app.run(debug=True)
