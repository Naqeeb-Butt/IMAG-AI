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
app.use((req, res, next) => {
    console.log('Request URL:', req.url);
    console.log('Request Method:', req.method);
    next();
});
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.png')) {
            res.setHeader('Cache-Control', 'no-cache');
            console.log('Serving image:', filePath);
        }
    }
}));

// Constants
const API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2";
const MAX_RETRIES = 20;
const RETRY_DELAY = 5000;
const IMAGE_DIR = "generated_images";

// Add this function near the top
function ensureDirectoryExists() {
    const imagesDir = path.join(__dirname, "public", IMAGE_DIR);
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }
    fs.chmodSync(imagesDir, '777');  // Full permissions
    return imagesDir;
}

// Add this after the constants
function clearImageDirectory() {
    const imagesDir = path.join(__dirname, "public", IMAGE_DIR);
    if (fs.existsSync(imagesDir)) {
        fs.readdirSync(imagesDir).forEach(file => {
            const filePath = path.join(imagesDir, file);
            fs.unlinkSync(filePath);
        });
    }
}

// Add this before app.listen
clearImageDirectory();

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
        // Clean up old images (optional)
        const imagesDir = ensureDirectoryExists();
        const files = fs.readdirSync(imagesDir);
        files.forEach(file => {
            const filePath = path.join(imagesDir, file);
            const stats = fs.statSync(filePath);
            // Delete files older than 1 hour
            if (Date.now() - stats.mtime.getTime() > 3600000) {
                fs.unlinkSync(filePath);
            }
        });

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
                    const timestamp = Date.now();
                    const sanitizedPrompt = userPrompt.slice(0, 30).replace(/[^a-z0-9]/gi, '_');
                    const fileName = `${timestamp}_${sanitizedPrompt}.png`;
                    const imagePath = path.join(imagesDir, fileName);
                    
                    // Write file
                    fs.writeFileSync(imagePath, response.data);
                    fs.chmodSync(imagePath, '644');  // Make image readable
                    
                    // Log for debugging
                    console.log('Image saved to:', imagePath);
                    console.log('Sending URL:', `/${IMAGE_DIR}/${fileName}`);
                    
                    return res.json({ 
                        success: true,
                        imageUrl: `/${IMAGE_DIR}/${fileName}`,
                        prompt: userPrompt,
                        timestamp: timestamp // Add timestamp for cache busting
                    });
                }

                console.log('Unexpected response type:', response.headers["content-type"]);
                return res.status(500).json({ error: "Invalid response type from API" });

            } catch (error) {
                console.error('API Error:', {
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message
                });

                if (error.response?.status === 503) {
                    const estimatedTime = JSON.parse(error.response.data)?.estimated_time || 0;
                    const waitTime = Math.max(RETRY_DELAY, estimatedTime * 1000);
                    console.log(`Model loading. Waiting ${waitTime/1000}s before retry ${retries + 1}/${MAX_RETRIES}`);
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                throw error;
            }
        }

        return res.status(503).json({ 
            error: "Service unavailable after retries",
            message: "The AI model is still loading. Please try again in a few minutes."
        });

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

// Add this debug route
app.get("/debug-image/:filename", (req, res) => {
    const filename = req.params.filename;
    const imagePath = path.join(__dirname, "public", IMAGE_DIR, filename);
    
    console.log('Debug: Checking image path:', imagePath);
    console.log('Debug: File exists:', fs.existsSync(imagePath));
    
    if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath);
    } else {
        res.status(404).send('Image not found');
    }
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
