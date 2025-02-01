const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_URL = 'http://api.guerrillamail.com/ajax.php';

// CORS setup to allow all origins for now (for development purposes)
app.use(cors());

// Enable JSON body parsing
app.use(express.json());

// Helper function to generate email address
async function generateEmail() {
    try {
        const response = await axios.get(BASE_URL, { params: { f: 'get_email_address' } });
        const data = response.data;
        return { email: data.email_addr, sid_token: data.sid_token };
    } catch (error) {
        console.error('Error generating email:', error);
        throw new Error('Unable to generate email');
    }
}

// Helper function to check for messages
async function checkMessages(sid_token, seq) {
    try {
        const response = await axios.get(BASE_URL, {
            params: { f: 'check_email', sid_token: sid_token, seq: seq }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw new Error('Unable to fetch messages');
    }
}

// Helper function to fetch an email's full content
async function fetchEmail(mail_id, sid_token) {
    try {
        const response = await axios.get(BASE_URL, {
            params: { f: 'fetch_email', email_id: mail_id, sid_token: sid_token }
        });
        return response.data.mail_body || 'No content';
    } catch (error) {
        console.error('Error fetching email:', error);
        return 'Error fetching email content';
    }
}

// Endpoint to generate a new email
app.post('/generate_email', async (req, res) => {
    try {
        const { email, sid_token } = await generateEmail();
        res.status(200).json({ email, sid_token });
    } catch (error) {
        res.status(500).json({ error: 'Unable to generate email' });
    }
});

// Endpoint to check for new emails
app.get('/check_messages', async (req, res) => {
    const { sid_token, seq } = req.query;
    try {
        const data = await checkMessages(sid_token, seq);
        if (!data || !data.list) {
            return res.status(404).json({ error: 'No messages found' });
        }
        res.status(200).json({ messages: data.list, seq: data.seq });
    } catch (error) {
        res.status(500).json({ error: 'Unable to fetch messages' });
    }
});

// Endpoint to fetch a specific email's content
app.get('/fetch_email', async (req, res) => {
    const { mail_id, sid_token } = req.query;
    try {
        const mailContent = await fetchEmail(mail_id, sid_token);
        res.status(200).json({ content: mailContent });
    } catch (error) {
        res.status(500).json({ error: 'Unable to fetch email content' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
