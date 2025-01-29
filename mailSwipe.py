from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import string
import requests
import pyperclip
import re
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

API = 'https://www.1secmail.com/api/v1/'
domainList = ['1secmail.com', '1secmail.net', '1secmail.org']

emails = {}
email_messages = {}

def generate_username():
    name = string.ascii_lowercase + string.digits
    username = ''.join(random.choice(name) for _ in range(10))
    return username

def extract(newMail):
    getUserName = re.search(r'login=(.*)&', newMail).group(1)
    getDomain = re.search(r'domain=(.*)', newMail).group(1)
    return [getUserName, getDomain]

def check_mails(user, domain):
    reqLink = f'{API}?action=getMessages&login={user}&domain={domain}'
    req = requests.get(reqLink).json()
    messages = []

    if len(req) != 0:
        for i in req:
            msgRead = f'{API}?action=readMessage&login={user}&domain={domain}&id={i["id"]}'
            msg = requests.get(msgRead).json()
            messages.append({
                'sender': msg.get('from'),
                'subject': msg.get('subject'),
                'date': msg.get('date'),
                'content': msg.get('textBody')
            })
    return messages

@app.route('/generate', methods=['POST'])
def generate_email():
    data = request.json
    username = data.get('username')
    domain = data.get('domain')

    if not username or not domain:
        return jsonify({'error': 'Username and domain are required.'}), 400

    temp_email = f"{username}@{domain}"
    newMail = f"{API}?login={username}&domain={domain}"
    requests.get(newMail)
    pyperclip.copy(temp_email)
    expires_at = datetime.utcnow() + timedelta(days=1)

    emails[username] = {'email': temp_email, 'expires_at': expires_at}
    email_messages[temp_email] = []

    return jsonify({'tempEmail': temp_email, 'expiresAt': expires_at.isoformat()}), 201

@app.route('/inbox/<string:username>', methods=['GET'])
def fetch_inbox(username):
    if username not in emails or datetime.utcnow() > emails[username]['expires_at']:
        return jsonify([])

    temp_email = emails[username]['email']
    messages = check_mails(*extract(f"{API}?login={username}&domain={emails[username]['email'].split('@')[1]}"))
    email_messages[temp_email] = messages

    return jsonify({'email': temp_email, 'messages': messages})

@app.route('/delete/<string:username>', methods=['DELETE'])
def delete_email(username):
    if username in emails:
        temp_email = emails[username]['email']
        del emails[username]
        del email_messages[temp_email]

    return jsonify({'message': f'Email {username} deleted successfully.'})

@app.route('/cleanup', methods=['DELETE'])
def cleanup_expired():
    now = datetime.utcnow()
    expired_emails = [user for user, data in emails.items() if now > data['expires_at']]

    for user in expired_emails:
        del emails[user]

    return jsonify({'message': f'{len(expired_emails)} expired emails deleted successfully.'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
