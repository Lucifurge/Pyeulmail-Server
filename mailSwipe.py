from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import string
import requests
import re
import os
import time
from datetime import datetime, timedelta

app = Flask(__name__)

# Allow CORS for frontend access
CORS(app, resources={r"/*": {"origins": "https://pyeulmails.onrender.com"}})

API = 'https://www.1secmail.com/api/v1/'
domainList = ['1secmail.com', '1secmail.net', '1secmail.org']

emails = {}
email_messages = {}

def generateUserName():
    name = string.ascii_lowercase + string.digits
    username = ''.join(random.choice(name) for i in range(10))
    return username

def extract(newMail):
    getUserName = re.search(r'login=(.*)&', newMail).group(1)
    getDomain = re.search(r'domain=(.*)', newMail).group(1)
    return [getUserName, getDomain]

def print_statusline(msg: str):
    last_msg_length = len(print_statusline.last_msg) if hasattr(print_statusline, 'last_msg') else 0
    print(' ' * last_msg_length, end='\r')
    print(msg, end='\r')
    sys.stdout.flush()
    print_statusline.last_msg = msg

def deleteMail(mail):
    url = 'https://www.1secmail.com/mailbox'
    data = {
        'action': 'deleteMailbox',
        'login': f'{extract(mail)[0]}',
        'domain': f'{extract(mail)[1]}'
    }
    print_statusline(f"Disposing your email address - {mail}\n")
    requests.post(url, data=data)

def checkMails(mail):
    reqLink = f'{API}?action=getMessages&login={extract(mail)[0]}&domain={extract(mail)[1]}'
    req = requests.get(reqLink).json()
    length = len(req)
    
    if length == 0:
        return {"status": "Your mailbox is empty. Hold tight. Mailbox is refreshed automatically every 5 seconds."}
    
    idList = []
    for i in req:
        if 'id' in i:
            idList.append(i['id'])

    x = 'mails' if length > 1 else 'mail'
    print_statusline(f"You received {length} {x}. (Mailbox is refreshed automatically every 5 seconds.)")

    current_directory = os.getcwd()
    final_directory = os.path.join(current_directory, r'All Mails')
    if not os.path.exists(final_directory):
        os.makedirs(final_directory)

    mail_list = []
    for i in idList:
        msgRead = f'{API}?action=readMessage&login={extract(mail)[0]}&domain={extract(mail)[1]}&id={i}'
        req = requests.get(msgRead).json()
        sender = req.get('from')
        subject = req.get('subject')
        date = req.get('date')
        content = req.get('textBody')

        mail_list.append({
            'sender': sender,
            'subject': subject,
            'date': date,
            'content': content
        })

    return {"status": f"You received {length} {x}.", "mails": mail_list}

@app.route("/generate", methods=["GET"])
def generate_email():
    # Generate email address
    username = generateUserName()
    domain = random.choice(domainList)
    temp_email = f"{username}@{domain}"
    
    # Request to create the temporary email
    requests.get(f"{API}?login={username}&domain={domain}")
    
    # Store email and set expiration time for 24 hours
    expires_at = datetime.utcnow() + timedelta(days=1)
    emails[username] = {'email': temp_email, 'expires_at': expires_at}

    # Return the generated email to the frontend
    return jsonify({"status": "Email generated successfully", "email": temp_email})

@app.route("/checkMails", methods=["GET"])
def check_emails():
    # Fetch the email from the request
    mail = request.args.get('email')
    if mail not in emails:
        return jsonify({"status": "Invalid email address."}), 400
    
    # Get the mailbox content
    mail_data = checkMails(mail)
    return jsonify(mail_data)

@app.route("/deleteEmail", methods=["POST"])
def delete_email():
    # Fetch the email from the request
    mail = request.json.get('email')
    if mail not in emails:
        return jsonify({"status": "Invalid email address."}), 400
    
    # Delete the email
    deleteMail(mail)
    return jsonify({"status": "Email deleted successfully."})

if __name__ == "__main__":
    app.run(debug=True)
