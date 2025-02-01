const express = require('express');
const axios = require('axios');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const BASE_URL = "http://api.guerrillamail.com/ajax.php";

app.use(cors());
app.use(bodyParser.json()); // Parse JSON payloads

let emailData = {}; // Store user-specific email data keyed by SID token

// Route to generate a new email address
app.post('/generate_email', async (req, res) => {
    try {
        // Generate a random SID token
        const sid_token = generateSidToken();

        // Fetch the email address from Guerrilla Mail API
        const response = await axios.get(BASE_URL, {
            params: {
                f: 'get_email_address'
            }
        });

        const email = response.data.email_addr;

        // Save the generated email data under the SID token
        emailData[sid_token] = {
            email: email,
            messages: [],
            seq: 0,
        };

        // Respond with the generated email and SID token
        res.json({ email, sid_token });
    } catch (error) {
        console.error('Error generating email:', error);
        res.status(500).json({ error: 'Error generating email address' });
    }
});

// Route to check for new messages
app.get('/check_messages', async (req, res) => {
    const { sid_token, seq } = req.query;

    if (!emailData[sid_token]) {
        return res.status(400).json({ error: 'Invalid SID token' });
    }

    const currentSeq = parseInt(seq) || 0;

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                f: 'check_email',
                sid_token: sid_token,
                seq: currentSeq
            }
        });

        const mailList = response.data.messages || [];
        const newSeq = response.data.seq;

        // Save new messages to the session
        emailData[sid_token].messages = mailList;
        emailData[sid_token].seq = newSeq;

        // Return the new messages and updated sequence
        res.json({
            messages: mailList,
            seq: newSeq
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

// Route to fetch full email content
app.get('/fetch_email', async (req, res) => {
    const { mail_id, sid_token } = req.query;

    if (!emailData[sid_token]) {
        return res.status(400).json({ error: 'Invalid SID token' });
    }

    const message = emailData[sid_token].messages.find(msg => msg.id === mail_id);

    if (!message) {
        return res.status(404).json({ error: 'Email not found' });
    }

    res.json({
        content: message.mail_body
    });
});

// Helper function to generate a random SID token
function generateSidToken() {
    return Math.random().toString(36).substring(2);  // Random string for SID
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
