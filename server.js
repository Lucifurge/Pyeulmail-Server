const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const BASE_URL = "http://api.guerrillamail.com/ajax.php";
const app = express();

app.use(cors());
app.use(bodyParser.json()); // Parse JSON payloads

let emailData = {}; // Store user-specific email data keyed by SID token

// Function to generate a new email address
async function getEmailAddress() {
  const params = { f: 'get_email_address' };
  try {
    const response = await axios.get(BASE_URL, { params });
    const data = response.data;
    const email = data.email_addr || '';
    const sidToken = data.sid_token || '';
    return { email, sidToken };
  } catch (error) {
    console.error("Error generating email address:", error);
    return null;
  }
}

// Function to check for new messages
async function checkEmail(sidToken, seq) {
  const params = { f: 'check_email', sid_token: sidToken, seq };
  try {
    const response = await axios.get(BASE_URL, { params });
    const data = response.data;
    return { messages: data.messages || [], seq: data.seq || seq };
  } catch (error) {
    console.error("Error fetching messages:", error);
    return { messages: [], seq };
  }
}

// Function to fetch the full email content
async function fetchEmail(mailId, sidToken) {
  const params = { f: 'fetch_email', email_id: mailId, sid_token: sidToken };
  try {
    const response = await axios.get(BASE_URL, { params });
    const data = response.data;
    return data.mail_body || 'No content';
  } catch (error) {
    console.error("Error fetching email content:", error);
    return 'Error fetching content';
  }
}

// API route to generate an email
app.post('/generate_email', async (req, res) => {
  const { email, sidToken } = await getEmailAddress();
  
  if (email) {
    res.json({ email, sid_token: sidToken });
    console.log(`[+] Email generated: ${email}`);
    emailData[sidToken] = { email, seq: 0 }; // Store sidToken with sequence for checking emails
  } else {
    res.status(500).json({ error: 'Error generating email address' });
  }
});

// API route to check emails
app.post('/check_messages', async (req, res) => {
  const { sid_token } = req.body;
  if (!sid_token || !emailData[sid_token]) {
    return res.status(400).json({ error: 'Invalid or expired session token' });
  }

  const { seq } = emailData[sid_token];
  
  const { messages, seq: newSeq } = await checkEmail(sid_token, seq);
  emailData[sid_token].seq = newSeq; // Update sequence
  
  if (messages.length > 0) {
    const messageDetails = [];
    for (const msg of messages) {
      const { mail_id, mail_from, mail_subject } = msg;
      const mailContent = await fetchEmail(mail_id, sid_token);
      messageDetails.push({ mail_from, mail_subject, mailContent });
    }
    return res.json({ messages: messageDetails });
  } else {
    return res.json({ messages: [] });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
