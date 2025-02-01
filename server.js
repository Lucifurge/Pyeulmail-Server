const express = require('express');
const axios = require('axios');
const app = express();
const cors = require('cors');
app.use(express.json());
app.use(cors());  // Allow all domains (you can restrict this to your domain later)

const BASE_URL = 'http://api.guerrillamail.com/ajax.php';

// Helper function to generate email address
async function generateEmail() {
    const response = await axios.get(BASE_URL, { params: { f: 'get_email_address' } });
    const data = response.data;
    return { email: data.email_addr, sid_token: data.sid_token };
}

// Helper function to check for messages
async function checkMessages(sidToken, seq) {
    const response = await axios.get(BASE_URL, {
        params: { f: 'check_email', sid_token: sidToken, seq: seq }
    });
    return response.data; // Ensure the response has the correct structure
}

// Helper function to delete email
async function deleteEmail(mailId, sidToken) {
    const response = await axios.get(BASE_URL, {
        params: { f: 'delete_email', mail_id: mailId, sid_token: sidToken }
    });
    return response.data;
}

// Generate email route
app.post('/generate_email', async (req, res) => {
    try {
        const { email, sid_token } = await generateEmail();
        res.status(200).json({ email, sid_token });
    } catch (error) {
        console.error('Error generating email:', error);
        res.status(502).json({ error: 'Unable to generate email' });
    }
});

// Check email messages route (updated to accept query params)
app.get('/check_messages', async (req, res) => {
    const { sid_token, seq } = req.query;  // Extract sid_token and seq from query parameters
    try {
        const data = await checkMessages(sid_token, seq);
        if (!data || !data.list) {
            return res.status(404).json({ error: 'No messages found or invalid response structure' });
        }
        res.status(200).json({ messages: data.list, seq: data.seq });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(502).json({ error: 'Unable to fetch messages' });
    }
});

// Delete email route (updated to accept query params)
app.get('/delete_email', async (req, res) => {
    const { mail_id, sid_token } = req.query;  // Extract mail_id and sid_token from query parameters
    try {
        const response = await deleteEmail(mail_id, sid_token);
        if (response.error) {
            return res.status(404).json({ error: 'Unable to delete email' });
        }
        res.status(200).json({ message: 'Email deleted' });
    } catch (error) {
        console.error('Error deleting email:', error);
        res.status(502).json({ error: 'Unable to delete email' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
