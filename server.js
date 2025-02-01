const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const readline = require('readline');
const BASE_URL = "http://api.guerrillamail.com/ajax.php";
const app = express();

app.use(cors());
app.use(bodyParser.json()); // Parse JSON payloads

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let emailData = {}; // Store user-specific email data keyed by SID token

// Helper function to handle user input
function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

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

// API route to generate an email and listen for messages
app.post('/generate_email', async (req, res) => {
  const { email, sidToken } = await getEmailAddress();
  
  if (email) {
    res.json({ email, sid_token: sidToken });
    console.log(`[+] Email generated: ${email}`);
    
    // Wait for messages after email generation
    let seq = 0;
    let continueChecking = true;

    while (continueChecking) {
      const { messages, seq: newSeq } = await checkEmail(sidToken, seq);
      if (messages.length > 0) {
        messages.forEach(async (msg) => {
          const { mail_id, mail_from, mail_subject } = msg;
          console.log(`[+] New message from ${mail_from}`);
          console.log(`Subject: ${mail_subject}`);
          
          const mailContent = await fetchEmail(mail_id, sidToken);
          console.log(mailContent);
        });
      } else {
        console.log("[!] No new messages yet. Checking again...");
      }
      
      // Ask user if they want to continue or exit after checking for a while
      const userChoice = await askQuestion('\nWould you like to continue checking for messages? (y/n): ');
      if (userChoice.trim().toLowerCase() === 'n') {
        continueChecking = false;
        console.log("Exiting...");
      }
      seq = newSeq;
    }
  } else {
    res.status(500).json({ error: 'Error generating email address' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
