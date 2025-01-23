require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 49152; // Different port from LOGOAI

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Constants
const API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2";
const MAX_RETRIES = 20;
const RETRY_DELAY = 5000;

// Image generation endpoint
app.get("/generate-image", async (req, res) => {
    const userPrompt = req.query.prompt;

    if (!userPrompt) {
        return res.status(400).json({ error: "Prompt is required" });
    }

    if (!process.env.HUGGING_FACE_API_TOKEN) {
        return res.status(500).json({ error: "API token not configured" });
    }

    let retries = 0;

    try {
        while (retries < MAX_RETRIES) {
            try {
                console.log('Making API request with prompt:', userPrompt);
                const response = await axios({
                    method: 'post',
                    url: API_URL,
                    headers: {
                        Authorization: `Bearer ${process.env.HUGGING_FACE_API_TOKEN}`
                    },
                    data: { inputs: userPrompt },
                    responseType: 'arraybuffer'
                });

                if (response.headers["content-type"].startsWith("image")) {
                    const publicDir = path.join(__dirname, "public");
                    if (!fs.existsSync(publicDir)) {
                        fs.mkdirSync(publicDir);
                    }

                    const timestamp = Date.now();
                    const imagePath = path.join(publicDir, `generated_image_${timestamp}.png`);
                    fs.writeFileSync(imagePath, response.data);
                    
                    // Send the image URL instead of the file
                    return res.json({ 
                        success: true,
                        imageUrl: `/generated_image_${timestamp}.png`
                    });
                }

                console.log('Unexpected response type:', response.headers["content-type"]);
                return res.status(500).json({ error: "Invalid response type from API" });

            } catch (error) {
                console.error('API Error:', {
                    status: error.response?.status,
                    data: error.response?.data?.toString(),
                    message: error.message
                });

                if (error.response?.status === 503) {
                    console.log(`Retry attempt ${retries + 1} of ${MAX_RETRIES}...`);
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    continue;
                }
                throw error;
            }
        }

        return res.status(503).json({ error: "Service unavailable after retries" });

    } catch (error) {
        console.error("Error generating image:", error);
        return res.status(500).json({
            error: "Failed to generate image",
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK',
        apiKeyExists: !!process.env.HUGGING_FACE_API_TOKEN
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Image AI Server running at http://0.0.0.0:${PORT}`);
    console.log('API Token exists:', !!process.env.HUGGING_FACE_API_TOKEN);
});
