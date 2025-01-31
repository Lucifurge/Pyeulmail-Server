from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import time
from datetime import datetime, timedelta
import html

app = Flask(__name__)

# Allow CORS for the specific frontend domain (using '*' for debugging, replace with specific domains for production)
CORS(app, resources={r"/*": {"origins": "*"}})

BASE_URL = "http://api.guerrillamail.com/ajax.php"

# Store emails and their expiration times
emails = {}

# Helper function to get email address
def get_email_address(session):
    params = {'f': 'get_email_address'}
    response = session.get(BASE_URL, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()
    return data.get("email_addr", ""), data.get("sid_token", "")

# Helper function to check email for new messages
def check_email(session, sid_token, seq):
    params = {'f': 'check_email', 'sid_token': sid_token, 'seq': seq}
    response = session.get(BASE_URL, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()
    return data.get("list", []), data.get("seq", seq)

# Helper function to fetch email content
def fetch_email(session, mail_id, sid_token):
    params = {'f': 'fetch_email', 'email_id': mail_id, 'sid_token': sid_token}
    response = session.get(BASE_URL, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()
    return html.unescape(data.get('mail_body', 'No content'))

@app.route("/generate", methods=["POST"])
def generate_email():
    try:
        session = requests.Session()
        email_address, sid_token = get_email_address(session)

        if email_address:
            # Store email and set expiration time for 24 hours
            expires_at = datetime.utcnow() + timedelta(days=1)
            emails[email_address] = {'email': email_address, 'sid_token': sid_token, 'expires_at': expires_at}
            return jsonify({"status": "Email generated successfully", "email": email_address})
        else:
            return jsonify({"status": "Failed to generate email"}), 400
    except requests.RequestException as e:
        return jsonify({"status": "Error generating email", "error": str(e)}), 500

@app.route("/checkMails", methods=["GET"])
def check_emails():
    mail = request.args.get('email')
    if mail not in emails:
        return jsonify({"status": "Invalid email address."}), 400

    session = requests.Session()
    sid_token = emails[mail]['sid_token']
    seq = 0

    # Check email every 15 seconds until new messages are found
    try:
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
    except requests.RequestException as e:
        return jsonify({"status": "Error checking emails", "error": str(e)}), 500

@app.route("/deleteEmail", methods=["POST"])
def delete_email():
    try:
        mail = request.json.get('email')
        if mail not in emails:
            return jsonify({"status": "Invalid email address."}), 400

        # Optional: Implement email deletion logic if needed
        emails.pop(mail, None)
        return jsonify({"status": "Email deleted successfully."})
    except Exception as e:
        return jsonify({"status": "Error deleting email", "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
