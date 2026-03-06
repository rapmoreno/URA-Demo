export default function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      // Return configuration with environment variables or defaults
      const config = {
        avatarUrl: process.env.READYPLAYERME_AVATAR_URL || process.env.AVATAR_URL || 'https://models.readyplayer.me/68c431b7c036016545e47f62.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
        voiceId: process.env.VOICE_ID || 'auto'
      };

      res.status(200).json(config);
    } catch (error) {
      console.error('Config API error:', error);
      res.status(500).json({ 
        error: 'Failed to load configuration',
        avatarUrl: 'https://models.readyplayer.me/68c431b7c036016545e47f62.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
        voiceId: 'auto'
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
