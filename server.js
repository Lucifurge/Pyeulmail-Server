const express = require('express');
const axios = require('axios');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');

app.use(cors());
app.use(bodyParser.json()); // Parse JSON payloads

// In-memory storage for user session data (for demonstration purposes)
// In production, use a proper session or JWT-based system
let emailData = {};  // store user-specific email data keyed by SID token

// Route to generate a new email address
app.post('/generate_email', (req, res) => {
    // Generate a random email and a new SID token
    const sid_token = generateSidToken();  // Generate a random SID token
    const email = generateRandomEmail();   // Generate a random email address

    // Save the generated email data under the SID token
    emailData[sid_token] = {
        email: email,
        messages: [],
        seq: 0,  // Starting sequence for message polling
    };

    // Respond with the generated email and SID token
    res.json({ email, sid_token });
});

// Route to check for new messages
app.get('/check_messages', (req, res) => {
    const { sid_token, seq } = req.query;

    // Ensure SID token exists
    if (!emailData[sid_token]) {
        return res.status(400).json({ error: 'Invalid SID token' });
    }

    // Get the current email data
    const email = emailData[sid_token];
    const currentSeq = parseInt(seq) || 0;

    // Simulate fetching new messages (e.g., from an email provider or database)
    const newMessages = fetchNewMessages(email.seq, currentSeq);

    // Return the new messages and updated sequence
    emailData[sid_token].seq = newMessages.seq;
    res.json({
        messages: newMessages.messages,
        seq: emailData[sid_token].seq
    });
});

// Route to fetch full email content
app.get('/fetch_email', (req, res) => {
    const { mail_id, sid_token } = req.query;

    // Ensure SID token exists
    if (!emailData[sid_token]) {
        return res.status(400).json({ error: 'Invalid SID token' });
    }

    // Get the current email data
    const email = emailData[sid_token];

    // Find the specific email by ID
    const message = email.messages.find(msg => msg.id === mail_id);

    if (!message) {
        return res.status(404).json({ error: 'Email not found' });
    }

    // Return the email content
    res.json({
        content: message.mail_body
    });
});

// Helper function to simulate fetching new messages
function fetchNewMessages(lastSeq, currentSeq) {
    // Simulate new messages
    const newMessages = [
        {
            id: `${currentSeq + 1}`,
            sender: `user${currentSeq + 1}@example.com`,
            subject: `Test Subject ${currentSeq + 1}`,
            mail_body: `This is the body of email number ${currentSeq + 1}`
        },
        {
            id: `${currentSeq + 2}`,
            sender: `user${currentSeq + 2}@example.com`,
            subject: `Test Subject ${currentSeq + 2}`,
            mail_body: `This is the body of email number ${currentSeq + 2}`
        }
    ];

    // Return new messages with updated sequence
    return {
        messages: newMessages,
        seq: currentSeq + newMessages.length
    };
}

// Helper function to generate a random SID token
function generateSidToken() {
    return Math.random().toString(36).substring(2);  // Random string for SID
}

// Helper function to generate a random email address
function generateRandomEmail() {
    const randomString = Math.random().toString(36).substring(2, 10);  // Random string for email
    return `${randomString}@tempmail.com`;
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
