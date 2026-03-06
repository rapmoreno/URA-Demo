// RPM-HCC: Modular ReadyPlayerMe Avatar Server
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv').config();

// Vercel serverless: cwd is deployment root; __dirname can vary
const BASE_DIR = process.env.VERCEL === '1' ? process.cwd() : __dirname;

// Import API routes
const ttsRoutes = require('./api/tts');
const chatbotRoutes = require('./api/chatbot');
const ChatbotWebSocket = require('./api/websocket');

const app = express();
const PORT = process.env.PORT || 5598;

// Create HTTP server
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(BASE_DIR, 'public')));

// Configure AWS from environment
const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-southeast-1'
});

// API Routes
app.use('/api', ttsRoutes);
app.use('/api', chatbotRoutes);

// Main page - RPM Chatbot with Book Covers (KoraV5)
app.get('/', (req, res) => {
  res.sendFile(path.join(BASE_DIR, 'public', 'rpm-chatbot.html'));
});

// Config endpoint
app.get('/api/config', (req, res) => {
  try {
    const config = {
      avatarUrl: process.env.READYPLAYERME_AVATAR_URL || process.env.AVATAR_URL || 'https://models.readyplayer.me/68c431b7c036016545e47f62.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
      voiceId: process.env.VOICE_ID || 'Jasmine'
    };
    res.json(config);
  } catch (error) {
    console.error('Config API error:', error);
    res.status(500).json({ 
      error: 'Failed to load configuration',
      avatarUrl: process.env.READYPLAYERME_AVATAR_URL || 'https://models.readyplayer.me/68c431b7c036016545e47f62.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
      voiceId: 'Jasmine'
    });
  }
});

// Health check for Vercel
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'RPM-HCC TTS API Running!',
    timestamp: new Date().toISOString(),
    features: [
      'Claude AI Integration',
      'ReadyPlayerMe Avatar',
      'Amazon Polly TTS',
      'Book Cover Display',
      'Voice Recognition'
    ]
  });
});

// Start server (only in non-serverless environment)
if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    console.log('🚀 KORA-V5 Server Started!');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🎭 Chat: http://localhost:${PORT}`);
    console.log(`🔊 Health: http://localhost:${PORT}/api/health`);
    console.log('');
    console.log('🎤 KORA-V5 Features:');
    console.log('  ✅ Claude AI Integration (Official NLB Catalogue)');
    console.log('  ✅ Amazon Polly TTS + Lip-Sync');
    console.log('  ✅ ReadyPlayerMe 3D Avatars');
    console.log('  ✅ Official NLB Book Covers');
    console.log('  ✅ Voice Recognition');
    console.log('  ✅ WebSocket Real-time Chat');
    console.log('');
    
    // Initialize WebSocket server
    const chatbotWS = new ChatbotWebSocket(server);
    console.log('🔌 WebSocket server initialized');
    
    // Environment check
    if (!process.env.AWS_ACCESS_KEY_ID) {
      console.log('⚠️  Warning: AWS credentials not configured!');
      console.log('   Please check your .env file');
    }
  });
}

module.exports = app;