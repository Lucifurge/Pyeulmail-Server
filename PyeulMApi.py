import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import time
from datetime import datetime, timedelta
import html

app = Flask(__name__)

# Set up logging for better debugging
logging.basicConfig(level=logging.DEBUG)

# Allow CORS for the specific frontend domain
CORS(app, resources={r"/*": {"origins": "https://pyeulmails.onrender.com"}})

BASE_URL = "http://api.guerrillamail.com/ajax.php"

# Store emails and their expiration times
emails = {}

# Helper function to get email address
def get_email_address(session):
    try:
        params = {'f': 'get_email_address'}
        response = session.get(BASE_URL, params=params, timeout=10)
        response.raise_for_status()  # Will raise an HTTPError if the HTTP request failed
        data = response.json()
        return data.get("email_addr", ""), data.get("sid_token", "")
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching email: {e}")
        return "", ""  # Return empty if request failed

# Helper function to check email for new messages
def check_email(session, sid_token, seq):
    try:
        params = {'f': 'check_email', 'sid_token': sid_token, 'seq': seq}
        response = session.get(BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get("list", []), data.get("seq", seq)
    except requests.exceptions.RequestException as e:
        logging.error(f"Error checking email: {e}")
        return [], seq  # Return empty messages if failed

# Helper function to fetch email content
def fetch_email(session, mail_id, sid_token):
    try:
        params = {'f': 'fetch_email', 'email_id': mail_id, 'sid_token': sid_token}
        response = session.get(BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return html.unescape(data.get('mail_body', 'No content'))
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching email content: {e}")
        return 'Failed to fetch email content.'

@app.route("/generate", methods=["POST"])
def generate_email():
    session = requests.Session()
    email_address, sid_token = get_email_address(session)

    if email_address:
        expires_at = datetime.utcnow() + timedelta(days=1)
        emails[email_address] = {'email': email_address, 'sid_token': sid_token, 'expires_at': expires_at}
        return jsonify({"status": "Email generated successfully", "email": email_address})
    else:
        return jsonify({"status": "Failed to generate email"}), 400

@app.route("/checkMails", methods=["GET"])
def check_emails():
    mail = request.args.get('email')
    if mail not in emails:
        return jsonify({"status": "Invalid email address."}), 400

    session = requests.Session()
    sid_token = emails[mail]['sid_token']
    seq = 0

    messages, seq = check_email(session, sid_token, seq)
    while not messages:
        time.sleep(15)
        messages, seq = check_email(session, sid_token, seq)

    mail_list = []
    for msg in messages:
        mail_id = msg.get('mail_id')
        mail_from = msg.get('mail_from', 'Unknown')
        mail_subject = msg.get('mail_subject', 'No Subject')

        mail_content = fetch_email(session, mail_id, sid_token)

        mail_list.append({
            'sender': mail_from,
            'subject': mail_subject,
            'content': mail_content
        })

    return jsonify({"status": "New messages found.", "mails": mail_list})

@app.route("/deleteEmail", methods=["POST"])
def delete_email():
    mail = request.json.get('email')
    if mail not in emails:
        return jsonify({"status": "Invalid email address."}), 400

    emails.pop(mail, None)
    return jsonify({"status": "Email deleted successfully."})

if __name__ == "__main__":
    app.run(debug=True)
