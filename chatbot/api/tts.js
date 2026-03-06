// TTS API Routes
const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();

// Configure AWS Polly
const polly = new AWS.Polly();

// Voice mapping (English)
const VOICE_MAP = {
  neutral: 'Jasmine',
  happy: 'Jasmine',
  sad: 'Jasmine',
  angry: 'Jasmine',
  calm: 'Jasmine',
  energetic: 'Jasmine'
};

// Chinese voice mapping
const CHINESE_VOICE_MAP = {
  neutral: 'Zhiyu',
  happy: 'Zhiyu',
  sad: 'Zhiyu',
  angry: 'Zhiyu',
  calm: 'Zhiyu',
  energetic: 'Zhiyu'
};

// Neural-only voices that require the neural engine
const NEURAL_ONLY_VOICES = [
  'Jasmine', 'Hala', 'Zayd', 'Hiujin', 'Arlet', 'Jitka', 'Zhiyu', 'Sofie', 'Laura', 
  'Lisa', 'Olivia', 'Emma', 'Brian', 'Arthur', 'Kajal', 'Niamh', 'Aria', 'Ayanda', 
  'Suvi', 'Isabelle', 'Gabrielle', 'Liam', 'Léa', 'Rémi', 'Vicki', 'Daniel', 'Hannah', 
  'Sabrina', 'Bianca', 'Adriano', 'Takumi', 'Kazuha', 'Tomoko', 'Seoyeon', 'Jihye', 
  'Ida', 'Ola', 'Vitória', 'Inês', 'Mia', 'Andrés', 'Lucia', 'Sergio', 'Pedro', 
  'Lupe', 'Elin', 'Burcu'
];

// =====================================================
// TEXT CLEANING FUNCTIONS
// =====================================================

// Clean text for SSML to prevent InvalidSsmlException
function cleanTextForSSML(text) {
  return text
    // Remove or escape XML/SSML special characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Remove problematic characters that can cause SSML issues
    .replace(/[\u2000-\u206F\u2E00-\u2E7F\u3000-\u303F]/g, ' ') // Various spaces and punctuation
    .replace(/[\u2010-\u2027]/g, '-') // Various dashes to regular dash
    .replace(/[\u2030-\u205E]/g, '') // Remove various symbols
    .replace(/[\u00A0]/g, ' ') // Non-breaking space to regular space
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// =====================================================
// LANGUAGE DETECTION FUNCTIONS
// =====================================================

// Detect if text contains Chinese characters
function detectChineseText(text) {
  // Chinese Unicode ranges:
  // \u4e00-\u9fff: CJK Unified Ideographs (most common Chinese characters)
  // \u3400-\u4dbf: CJK Extension A
  // \uf900-\ufaff: CJK Compatibility Ideographs
  const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
  const hasChineseChars = chineseRegex.test(text);
  
  // Calculate percentage of Chinese characters
  const chineseMatches = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || [];
  const totalChars = text.replace(/\s/g, '').length; // Remove spaces for character count
  const chinesePercentage = totalChars > 0 ? (chineseMatches.length / totalChars) * 100 : 0;
  
  console.log(`🔍 Language Detection: ${chineseMatches.length}/${totalChars} Chinese chars (${chinesePercentage.toFixed(1)}%)`);
  
  // Consider it Chinese if more than 20% of non-space characters are Chinese
  return {
    isChinese: hasChineseChars && chinesePercentage > 20,
    chinesePercentage: chinesePercentage,
    hasChineseChars: hasChineseChars
  };
}

// =====================================================
// PHASE 1: VOICE COMMAND DETECTION FUNCTIONS
// =====================================================

// Voice control command detection (Phase 1 - Detection only)
function detectVoiceCommands(text) {
  const lowerText = text.toLowerCase();
  let volumeChange = 0;
  let speedChange = 0;
  let volumeDirection = '';
  let speedDirection = '';
  let preset = null;

  // Volume commands - ONLY 3 LEVELS for demo
  if (lowerText.includes('maximum volume') || lowerText.includes('max volume') || lowerText.includes('loudest') || 
      lowerText.includes('as loud as possible') || lowerText.includes('full volume') || lowerText.includes('crank it up') ||
      lowerText.includes('louder') || lowerText.includes('speak up') || lowerText.includes("can't hear") || lowerText.includes('too soft')) {
    volumeChange = 10; // Jump directly to MAXIMUM
    volumeDirection = 'to maximum';
  } else if (lowerText.includes('minimum volume') || lowerText.includes('min volume') || lowerText.includes('quietest') || 
             lowerText.includes('as quiet as possible') || lowerText.includes('whisper') ||
             lowerText.includes('softer') || lowerText.includes('quieter') || lowerText.includes('lower') || lowerText.includes('too loud')) {
    volumeChange = -10; // Jump directly to MINIMUM
    volumeDirection = 'to minimum';
  } else if (lowerText.includes('normal volume') || lowerText.includes('regular volume')) {
    volumeChange = 'reset'; // Go to NORMAL
    volumeDirection = 'to normal';
  }

  // Speed commands
  if (lowerText.includes('much faster') || lowerText.includes('way too slow')) {
    speedChange = 30; // speed_step * 2
    speedDirection = 'faster';
  } else if (lowerText.includes('much slower') || lowerText.includes('way too fast')) {
    speedChange = -30;
    speedDirection = 'slower';
  } else if (lowerText.includes('faster') || lowerText.includes('speed up') || lowerText.includes('quicker') || lowerText.includes('too slow')) {
    speedChange = 15;
    speedDirection = 'faster';
  } else if (lowerText.includes('slower') || lowerText.includes('slow down') || lowerText.includes('too fast')) {
    speedChange = -15;
    speedDirection = 'slower';
  } else if (lowerText.includes('normal speed') || lowerText.includes('regular speed') || lowerText.includes('regular pace')) {
    speedChange = 'reset';
    speedDirection = 'to normal';
  }

  // Special speed commands
  if (lowerText.includes("snail's pace")) {
    speedChange = 'snail';
    speedDirection = 'to snail\'s pace';
  } else if (lowerText.includes('lightning speed')) {
    speedChange = 'lightning';
    speedDirection = 'to lightning speed';
  }

  // Preset commands
  if (lowerText.includes('noisy') && lowerText.includes('environment')) {
    preset = 'noisy_environment';
  } else if (lowerText.includes('english is not my first language')) {
    preset = 'clear_speech';
  } else if (lowerText.includes('urgent') || lowerText.includes('emergency')) {
    preset = 'emergency_mode';
  } else if (lowerText.includes('read me a story')) {
    preset = 'story_mode';
  }

  return { volumeChange, speedChange, volumeDirection, speedDirection, preset };
}

// Test endpoint for voice command detection (Phase 1)
router.post('/detect-voice-commands', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const commands = detectVoiceCommands(text);
    
    res.json({
      success: true,
      text: text,
      detectedCommands: commands,
      hasVoiceCommands: commands.volumeChange !== 0 || commands.speedChange !== 0 || commands.preset !== null
    });
    
  } catch (error) {
    console.error('❌ Voice command detection error:', error);
    res.status(500).json({ error: 'Voice command detection failed' });
  }
});

// =====================================================
// PHASE 2: VOICE STATE MANAGEMENT
// =====================================================

// Voice state storage (similar to conversation storage in chatbot)
const voiceStates = new Map();

// Voice control settings with more dramatic adjustments
const DEFAULT_VOICE_SETTINGS = {
  current_volume_db: 0,
  min_volume_db: -10,
  max_volume_db: 10,
  volume_step: 10, // 10dB steps for 3 distinct levels only
  current_speed_rate: 100,
  min_speed_rate: 20,
  max_speed_rate: 200,
  speed_step: 25, // Increased from 15 to 25 for more noticeable changes
  senior_mode_active: false
};

// Apply voice control settings
function applyVoiceSettings(sessionId, commands) {
  if (!voiceStates.has(sessionId)) {
    voiceStates.set(sessionId, { ...DEFAULT_VOICE_SETTINGS });
  }
  
  const state = voiceStates.get(sessionId);
  
  // Handle presets first
  if (commands.preset) {
    switch (commands.preset) {
      case 'noisy_environment':
        state.current_volume_db = 6;
        state.current_speed_rate = 90;
        break;
      case 'clear_speech':
        state.current_volume_db = 1;
        state.current_speed_rate = 85;
        break;
      case 'emergency_mode':
        state.current_volume_db = 8;
        state.current_speed_rate = 120;
        break;
      case 'story_mode':
        state.current_volume_db = 1;
        state.current_speed_rate = 80;
        break;
    }
    return state;
  }

  // Apply volume changes
  if (commands.volumeChange === 'reset') {
    state.current_volume_db = 0;
  } else if (commands.volumeChange === 10) {
    state.current_volume_db = state.max_volume_db; // Force to maximum
  } else if (commands.volumeChange === -10) {
    state.current_volume_db = state.min_volume_db; // Force to minimum
  } else if (commands.volumeChange !== 0) {
    state.current_volume_db = Math.max(
      state.min_volume_db,
      Math.min(state.max_volume_db, state.current_volume_db + commands.volumeChange)
    );
  }

  // Apply speed changes
  if (commands.speedChange === 'reset') {
    state.current_speed_rate = 100;
  } else if (commands.speedChange === 'snail') {
    state.current_speed_rate = 20;
  } else if (commands.speedChange === 'lightning') {
    state.current_speed_rate = 180;
  } else if (commands.speedChange !== 0) {
    state.current_speed_rate = Math.max(
      state.min_speed_rate,
      Math.min(state.max_speed_rate, state.current_speed_rate + commands.speedChange)
    );
  }

  return state;
}

// Get voice control state
router.get('/voice-state/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const state = voiceStates.get(sessionId) || { ...DEFAULT_VOICE_SETTINGS };
  res.json({
    success: true,
    sessionId: sessionId,
    voiceState: state
  });
});

// Reset voice control state
router.post('/voice-reset/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  voiceStates.set(sessionId, { ...DEFAULT_VOICE_SETTINGS });
  res.json({
    success: true,
    message: 'Voice settings reset to defaults',
    sessionId: sessionId,
    voiceState: voiceStates.get(sessionId)
  });
});

// Test voice settings application (Phase 2)
router.post('/test-voice-settings', (req, res) => {
  try {
    const { text, sessionId = 'test-session' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Detect commands
    const commands = detectVoiceCommands(text);
    
    // Apply settings
    const voiceState = applyVoiceSettings(sessionId, commands);
    
    // Generate SSML preview
    const prosodyVolume = voiceState.current_volume_db >= 0 ? `+${voiceState.current_volume_db}dB` : `${voiceState.current_volume_db}dB`;
    const prosodyRate = `${voiceState.current_speed_rate}%`;
    
    let adjustmentText = '';
    if (commands.volumeChange !== 0 || commands.speedChange !== 0 || commands.preset) {
      let adjustments = [];
      if (commands.volumeDirection) adjustments.push(`volume ${commands.volumeDirection}`);
      if (commands.speedDirection) adjustments.push(`speaking speed ${commands.speedDirection}`);
      if (commands.preset) adjustments.push(`settings for ${commands.preset.replace('_', ' ')}`);
      
      if (adjustments.length > 0) {
        adjustmentText = `I've adjusted my ${adjustments.join(' and ')}. `;
      }
    }
    
    const sampleResponse = adjustmentText + "How can I help you today?";
    const ssmlPreview = `<speak><prosody volume="${prosodyVolume}" rate="${prosodyRate}">${sampleResponse}</prosody></speak>`;
    
    res.json({
      success: true,
      sessionId: sessionId,
      detectedCommands: commands,
      voiceState: voiceState,
      adjustmentMade: adjustmentText !== '',
      sampleResponse: sampleResponse,
      ssmlPreview: ssmlPreview
    });
    
  } catch (error) {
    console.error('❌ Voice settings test error:', error);
    res.status(500).json({ error: 'Voice settings test failed' });
  }
});

// =====================================================
// PHASE 3: ENHANCED TTS ENDPOINT WITH VOICE CONTROLS
// =====================================================

// Enhanced TTS endpoint with voice control support
router.post('/tts-enhanced', async (req, res) => {
  try {
    const { 
      text, 
      voice = 'auto', 
      emotion = 'neutral', 
      speed = '1.0',
      sessionId = 'default',
      userMessage = ''
    } = req.body;
    
    console.log(`🎤 TTS-Enhanced received - Text: "${text?.substring(0, 50)}..." Voice: "${voice}" Emotion: "${emotion}"`);
    console.log(`🔍 Full request body:`, req.body);

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Detect voice control commands from user message
    const voiceCommands = detectVoiceCommands(userMessage);
    const voiceState = applyVoiceSettings(sessionId, voiceCommands);

    // Generate adjustment acknowledgment if needed
    let adjustmentText = '';
    if (voiceCommands.volumeChange !== 0 || voiceCommands.speedChange !== 0 || voiceCommands.preset) {
      let adjustments = [];
      if (voiceCommands.volumeDirection) adjustments.push(`volume ${voiceCommands.volumeDirection}`);
      if (voiceCommands.speedDirection) adjustments.push(`speaking speed ${voiceCommands.speedDirection}`);
      if (voiceCommands.preset) adjustments.push(`settings for ${voiceCommands.preset.replace('_', ' ')}`);
      
      if (adjustments.length > 0) {
        adjustmentText = `I've adjusted my ${adjustments.join(' and ')}. `;
      }
    }

    // For language detection, use the main text (ignore adjustment text like "I've adjusted my volume")
    // This ensures language detection is based on the actual user content, not system messages
    const languageDetection = detectChineseText(text);
    let selectedVoice;
    
    if (voice === 'auto') {
      if (languageDetection.isChinese) {
        selectedVoice = CHINESE_VOICE_MAP[emotion] || 'Zhiyu';
        console.log(`🇨🇳 Chinese detected (${languageDetection.chinesePercentage.toFixed(1)}%) - Using Chinese voice: ${selectedVoice}`);
      } else {
        selectedVoice = VOICE_MAP[emotion] || 'Joanna';
        console.log(`🇺🇸 English detected - Using English voice: ${selectedVoice}`);
      }
    } else {
      selectedVoice = voice;
      console.log(`🎤 Manual voice selection: ${selectedVoice}`);
    }
    
    // Convert voice state to prosody values
    const prosodyRate = `${voiceState.current_speed_rate}%`;
    const prosodyVolume = voiceState.current_volume_db >= 0 ? `+${voiceState.current_volume_db}dB` : `${voiceState.current_volume_db}dB`;
    
    // Clean the text for SSML to avoid InvalidSsmlException
    const cleanedText = cleanTextForSSML(adjustmentText + text);
    let ssmlText;
    
    // Determine engine based on voice first
    const engine = NEURAL_ONLY_VOICES.includes(selectedVoice) ? 'neural' : 'standard';
    
    // Use more dramatic volume settings that AWS Polly can actually handle
    // Always respect the user's speed rate settings independently
    // SIMPLIFIED: Only 3 volume levels for demo
    if (voiceState.current_volume_db >= 10) {
      // MAXIMUM VOLUME - x-loud for dramatic effect
      ssmlText = `<speak><prosody volume="x-loud" rate="${prosodyRate}">${cleanedText}</prosody></speak>`;
    } else if (voiceState.current_volume_db <= -10) {
      // MINIMUM VOLUME - x-soft for whisper effect
      ssmlText = `<speak><prosody volume="x-soft" rate="${prosodyRate}">${cleanedText}</prosody></speak>`;
    } else {
      // NORMAL VOLUME - medium volume (default)
      ssmlText = `<speak><prosody volume="medium" rate="${prosodyRate}">${cleanedText}</prosody></speak>`;
    }

    console.log(`🎤 Enhanced TTS Request: "${cleanedText}" with ${selectedVoice} (${engine} engine) - Volume: ${prosodyVolume}, Speed: ${prosodyRate}`);
    console.log(`🔊 SSML being sent to Polly: ${ssmlText}`);

    // Check AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return res.status(503).json({ 
        error: 'TTS service unavailable - AWS credentials not configured',
        success: false,
        demo: true,
        voiceState: voiceState,
        adjustmentMade: adjustmentText !== ''
      });
    }

    const [audioResult, speechMarksResult] = await Promise.all([
      polly.synthesizeSpeech({
        Text: ssmlText,
        TextType: 'ssml',
        OutputFormat: 'mp3',
        VoiceId: selectedVoice,
        Engine: engine,
        SampleRate: '22050'
      }).promise(),
      polly.synthesizeSpeech({
        Text: ssmlText,
        TextType: 'ssml',
        OutputFormat: 'json',
        VoiceId: selectedVoice,
        Engine: engine,
        SpeechMarkTypes: ['word', 'viseme']
      }).promise()
    ]);
    
    const audioBase64 = audioResult.AudioStream.toString('base64');
    const speechMarksText = speechMarksResult.AudioStream.toString('utf-8').trim();
    
    let speechMarks = [];
    if (speechMarksText) {
      speechMarks = speechMarksText
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try { return JSON.parse(line); } catch (e) { return null; }
        })
        .filter(mark => mark !== null);
    }

    const words = cleanedText.split(' ');
    const wordMarks = speechMarks.filter(mark => mark.type === 'word');
    const visemeMarks = speechMarks.filter(mark => mark.type === 'viseme');

    res.json({
      success: true,
      audio: audioBase64,
      voice: selectedVoice,
      emotion: emotion,
      voiceState: voiceState,
      voiceCommands: voiceCommands,
      adjustmentMade: adjustmentText !== '',
      finalText: cleanedText,
      ssmlUsed: ssmlText,
      lipSync: generateLipSyncData(words, wordMarks, visemeMarks),
      duration: speechMarks.length > 0 ? Math.max(...speechMarks.map(m => m.time)) / 1000 : 3
    });

  } catch (error) {
    console.error('❌ Enhanced TTS Error:', error);
    res.status(500).json({ error: 'Enhanced TTS generation failed', details: error.message });
  }
});

// =====================================================
// EXISTING TTS FUNCTIONALITY (UNCHANGED)
// =====================================================

// Main TTS endpoint
router.post('/tts', async (req, res) => {
  try {
    const { text, voice = 'auto', emotion = 'neutral', speed = '1.0' } = req.body;
    
    console.log(`🎤 TTS received - Text: "${text?.substring(0, 50)}..." Voice: "${voice}" Emotion: "${emotion}"`);
    console.log(`🔍 Full request body:`, req.body);

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // For language detection, use the main text (ignore adjustment text like "I've adjusted my volume")
    // This ensures language detection is based on the actual user content, not system messages
    const languageDetection = detectChineseText(text);
    let selectedVoice;
    
    if (voice === 'auto') {
      if (languageDetection.isChinese) {
        selectedVoice = CHINESE_VOICE_MAP[emotion] || 'Zhiyu';
        console.log(`🇨🇳 Chinese detected (${languageDetection.chinesePercentage.toFixed(1)}%) - Using Chinese voice: ${selectedVoice}`);
      } else {
        selectedVoice = VOICE_MAP[emotion] || 'Joanna';
        console.log(`🇺🇸 English detected - Using English voice: ${selectedVoice}`);
      }
    } else {
      selectedVoice = voice;
      console.log(`🎤 Manual voice selection: ${selectedVoice}`);
    }
    const ssmlText = `<speak><prosody rate="${speed}" volume="loud">${text}</prosody></speak>`;
    
    // Determine engine based on voice
    const engine = NEURAL_ONLY_VOICES.includes(selectedVoice) ? 'neural' : 'standard';

    console.log(`🎤 TTS Request: "${text}" with ${selectedVoice} (${engine} engine)`);

    // Check AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return res.status(503).json({ 
        error: 'TTS service unavailable - AWS credentials not configured',
        success: false,
        demo: true
      });
    }

    const [audioResult, speechMarksResult] = await Promise.all([
      polly.synthesizeSpeech({
        Text: ssmlText,
        TextType: 'ssml',
        OutputFormat: 'mp3',
        VoiceId: selectedVoice,
        Engine: engine,
        SampleRate: '22050'
      }).promise(),
      polly.synthesizeSpeech({
        Text: ssmlText,
        TextType: 'ssml',
        OutputFormat: 'json',
        VoiceId: selectedVoice,
        Engine: engine,
        SpeechMarkTypes: ['word', 'viseme']
      }).promise()
    ]);
    
    const audioBase64 = audioResult.AudioStream.toString('base64');
    const speechMarksText = speechMarksResult.AudioStream.toString('utf-8').trim();
    
    let speechMarks = [];
    if (speechMarksText) {
      speechMarks = speechMarksText
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try { return JSON.parse(line); } catch (e) { return null; }
        })
        .filter(mark => mark !== null);
    }

    const words = text.split(' ');
    const wordMarks = speechMarks.filter(mark => mark.type === 'word');
    const visemeMarks = speechMarks.filter(mark => mark.type === 'viseme');

    res.json({
      success: true,
      audio: audioBase64,
      voice: selectedVoice,
      emotion: emotion,
      lipSync: generateLipSyncData(words, wordMarks, visemeMarks),
      duration: speechMarks.length > 0 ? Math.max(...speechMarks.map(m => m.time)) / 1000 : 3
    });

  } catch (error) {
    console.error('❌ TTS Error:', error);
    res.status(500).json({ error: 'TTS generation failed', details: error.message });
  }
});

// Generate lip-sync data
function generateLipSyncData(words, wordMarks, visemeMarks) {
  const visemeMap = {
    'p': 'PP', 'f': 'FF', 't': 'DD', 'T': 'TH', 'S': 'SS', 'r': 'RR',
    'k': 'kk', 'i': 'I', 'e': 'E', 'E': 'E', 'a': 'aa', 'o': 'O',
    'u': 'U', '@': 'aa', 'sil': 'sil'
  };

  const visemes = visemeMarks.map((mark, index) => ({
    viseme: visemeMap[mark.value] || 'sil',
    time: mark.time,
    duration: index < visemeMarks.length - 1 ? 
      visemeMarks[index + 1].time - mark.time : 200
  }));

  return {
    words: words,
    wordTimes: wordMarks.map(mark => mark.time),
    wordDurations: wordMarks.map((mark, index) => {
      const nextMark = wordMarks[index + 1];
      return nextMark ? nextMark.time - mark.time : 500;
    }),
    visemes: visemes.map(v => v.viseme),
    visemeTimes: visemes.map(v => v.time),
    visemeDurations: visemes.map(v => v.duration)
  };
}

// Emotion analysis
router.post('/analyze-emotion', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const emotion = analyzeEmotion(text);
    const expressions = getExpressionsForEmotion(emotion);
    
    res.json({
      success: true,
      emotion: emotion,
      expressions: expressions,
      mood: emotion,
      text: text
    });
  } catch (error) {
    res.status(500).json({ error: 'Emotion analysis failed' });
  }
});

function analyzeEmotion(text) {
  const lowerText = text.toLowerCase();
  const emotions = {
    happy: ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing'],
    sad: ['sad', 'sorry', 'unfortunate', 'disappointed', 'problem'],
    angry: ['angry', 'mad', 'furious', 'annoyed', 'frustrated'],
    surprised: ['surprised', 'shocked', 'amazed', 'wow', 'incredible'],
    neutral: ['hello', 'hi', 'okay', 'yes', 'no', 'maybe']
  };

  let maxScore = 0;
  let detectedEmotion = 'neutral';

  for (const [emotion, keywords] of Object.entries(emotions)) {
    const score = keywords.reduce((sum, keyword) => 
      sum + (lowerText.includes(keyword) ? 1 : 0), 0);
    if (score > maxScore) {
      maxScore = score;
      detectedEmotion = emotion;
    }
  }
  return detectedEmotion;
}

function getExpressionsForEmotion(emotion) {
  const map = {
    happy: ['😊', '😄'], sad: ['😢', '😞'], angry: ['😠', '😤'],
    surprised: ['😲', '😮'], neutral: ['😐'], love: ['😍', '🥰']
  };
  return map[emotion] || ['😐'];
}

// Dummy endpoint for TalkingHead compatibility
router.get('/dummy-tts', (req, res) => {
  res.json({ audioContent: "", error: "Using custom Polly integration" });
});

// =====================================================
// STREAMING TTS ENDPOINT
// =====================================================

// Streaming TTS endpoint - faster response with single Polly call
router.post('/tts-stream', async (req, res) => {
  try {
    const { 
      text, 
      voice = 'auto', 
      emotion = 'neutral', 
      speed = '1.0',
      sessionId = 'default',
      userMessage = ''
    } = req.body;
    
    console.log(`🎤 TTS-Stream received - Text: "${text?.substring(0, 50)}..." Voice: "${voice}" Emotion: "${emotion}"`);
    console.log(`🔍 Full request body:`, req.body);

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Detect voice control commands from user message
    const voiceCommands = detectVoiceCommands(userMessage);
    const voiceState = applyVoiceSettings(sessionId, voiceCommands);

    // Generate adjustment acknowledgment if needed
    let adjustmentText = '';
    if (voiceCommands.volumeChange !== 0 || voiceCommands.speedChange !== 0 || voiceCommands.preset) {
      let adjustments = [];
      if (voiceCommands.volumeDirection) adjustments.push(`volume ${voiceCommands.volumeDirection}`);
      if (voiceCommands.speedDirection) adjustments.push(`speaking speed ${voiceCommands.speedDirection}`);
      if (voiceCommands.preset) adjustments.push(`settings for ${voiceCommands.preset.replace('_', ' ')}`);
      
      if (adjustments.length > 0) {
        adjustmentText = `I've adjusted my ${adjustments.join(' and ')}. `;
      }
    }

    // For language detection, use the main text (ignore adjustment text like "I've adjusted my volume")
    // This ensures language detection is based on the actual user content, not system messages
    const languageDetection = detectChineseText(text);
    let selectedVoice;
    
    if (voice === 'auto') {
      if (languageDetection.isChinese) {
        selectedVoice = CHINESE_VOICE_MAP[emotion] || 'Zhiyu';
        console.log(`🇨🇳 Chinese detected (${languageDetection.chinesePercentage.toFixed(1)}%) - Using Chinese voice: ${selectedVoice}`);
      } else {
        selectedVoice = VOICE_MAP[emotion] || 'Joanna';
        console.log(`🇺🇸 English detected - Using English voice: ${selectedVoice}`);
      }
    } else {
      selectedVoice = voice;
      console.log(`🎤 Manual voice selection: ${selectedVoice}`);
    }
    
    // Convert voice state to prosody values
    const prosodyRate = `${voiceState.current_speed_rate}%`;
    
    // Clean the text for SSML to avoid InvalidSsmlException
    const cleanedText = cleanTextForSSML(adjustmentText + text);
    let ssmlText;
    
    // Determine engine based on voice first
    const engine = NEURAL_ONLY_VOICES.includes(selectedVoice) ? 'neural' : 'standard';
    
    // Use simplified volume settings for streaming (faster processing)
    if (voiceState.current_volume_db >= 10) {
      ssmlText = `<speak><prosody volume="x-loud" rate="${prosodyRate}">${cleanedText}</prosody></speak>`;
    } else if (voiceState.current_volume_db <= -10) {
      ssmlText = `<speak><prosody volume="x-soft" rate="${prosodyRate}">${cleanedText}</prosody></speak>`;
    } else {
      ssmlText = `<speak><prosody volume="medium" rate="${prosodyRate}">${cleanedText}</prosody></speak>`;
    }

    console.log(`🎤 Streaming TTS Request: "${cleanedText}" with ${selectedVoice} (${engine} engine) - Speed: ${prosodyRate}`);

    // Check AWS credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return res.status(503).json({ 
        error: 'TTS service unavailable - AWS credentials not configured',
        success: false,
        demo: true,
        voiceState: voiceState,
        adjustmentMade: adjustmentText !== ''
      });
    }

    // STREAMING APPROACH: Only generate audio, use estimated lip-sync
    const audioResult = await polly.synthesizeSpeech({
      Text: ssmlText,
      TextType: 'ssml',
      OutputFormat: 'mp3',
      VoiceId: selectedVoice,
      Engine: engine,
      SampleRate: '22050'
    }).promise();
    
    const audioBase64 = audioResult.AudioStream.toString('base64');
    
    // Calculate actual audio duration from MP3 buffer size (more accurate)
    const audioBuffer = audioResult.AudioStream;
    const estimatedDurationFromSize = calculateAudioDurationFromBuffer(audioBuffer, 22050);
    
    // Generate lip-sync data synchronized to actual audio duration
    const syncedLipSync = generateSynchronizedLipSync(cleanedText, voiceState.current_speed_rate, estimatedDurationFromSize);
    
    res.json({
      success: true,
      audio: audioBase64,
      voice: selectedVoice,
      emotion: emotion,
      voiceState: voiceState,
      voiceCommands: voiceCommands,
      adjustmentMade: adjustmentText !== '',
      finalText: cleanedText,
      ssmlUsed: ssmlText,
      lipSync: syncedLipSync,
      duration: estimatedDurationFromSize,
      streaming: true // Flag to indicate this is streaming response
    });

  } catch (error) {
    console.error('❌ Streaming TTS Error:', error);
    res.status(500).json({ error: 'Streaming TTS generation failed', details: error.message });
  }
});

// Calculate approximate audio duration from MP3 buffer
function calculateAudioDurationFromBuffer(audioBuffer, sampleRate) {
  // More accurate MP3 duration estimation
  // MP3 files have frame headers that contain duration info
  try {
    const buffer = Buffer.from(audioBuffer);
    
    // Look for MP3 frame sync patterns (0xFFE or 0xFFF)
    let frameCount = 0;
    let totalBitrate = 0;
    let validFrames = 0;
    
    // MP3 bitrate table (MPEG-1 Layer III)
    const bitrateTable = {
      1: 32, 2: 40, 3: 48, 4: 56, 5: 64, 6: 80, 7: 96, 8: 112,
      9: 128, 10: 160, 11: 192, 12: 224, 13: 256, 14: 320
    };
    
    // Sample frequency table
    const sampleRateTable = {
      0: 44100, 1: 48000, 2: 32000
    };
    
    for (let i = 0; i < buffer.length - 4; i++) {
      // Look for frame sync (11 bits set)
      if ((buffer[i] === 0xFF) && ((buffer[i + 1] & 0xE0) === 0xE0)) {
        // Extract frame info
        const byte2 = buffer[i + 1];
        const byte3 = buffer[i + 2];
        
        // Check if this is a valid MP3 frame
        const version = (byte2 & 0x18) >> 3; // MPEG version
        const layer = (byte2 & 0x06) >> 1;   // Layer
        const bitrateIndex = (byte3 & 0xF0) >> 4;
        const sampleRateIndex = (byte3 & 0x0C) >> 2;
        
        if (version === 3 && layer === 1 && bitrateIndex > 0 && bitrateIndex < 15) {
          // Valid MPEG-1 Layer III frame
          const bitrate = bitrateTable[bitrateIndex];
          const sampleRate = sampleRateTable[sampleRateIndex] || 44100;
          
          if (bitrate) {
            totalBitrate += bitrate;
            validFrames++;
          }
          
          frameCount++;
          
          // Skip ahead by estimated frame size to avoid false positives
          const frameSize = Math.floor((144 * bitrate * 1000) / sampleRate);
          i += Math.max(1, frameSize - 10); // -10 for safety margin
        }
      }
    }
    
    if (validFrames > 0) {
      // Calculate duration based on average bitrate and file size
      const avgBitrate = totalBitrate / validFrames;
      const fileSizeInBits = buffer.length * 8;
      const duration = fileSizeInBits / (avgBitrate * 1000);
      
      console.log(`📊 MP3 Analysis: ${validFrames} frames, avg bitrate: ${avgBitrate}kbps, calculated duration: ${duration}s`);
      return Math.max(1.0, duration);
    }
  } catch (error) {
    console.warn('⚠️ MP3 analysis failed, using fallback calculation:', error.message);
  }
  
  // Fallback: More conservative estimation based on typical TTS characteristics
  // AWS Polly typically generates audio at ~128kbps for speech
  const estimatedBitrate = 128; // kbps
  const fileSizeInBits = audioBuffer.length * 8;
  const duration = fileSizeInBits / (estimatedBitrate * 1000);
  
  // Apply speech-specific correction factor (TTS is usually denser than music)
  const speechCorrectionFactor = 0.85;
  const correctedDuration = duration * speechCorrectionFactor;
  
  console.log(`📊 Fallback calculation: ${audioBuffer.length} bytes -> ${correctedDuration}s (${estimatedBitrate}kbps estimated)`);
  return Math.max(1.0, correctedDuration);
}

// Generate synchronized lip-sync data based on actual audio duration
function generateSynchronizedLipSync(text, speedRate = 100, actualDuration) {
  const words = text.split(' ').filter(word => word.length > 0);
  
  if (words.length === 0) {
    return {
      words: [],
      wordTimes: [],
      wordDurations: [],
      visemes: ['sil'],
      visemeTimes: [0],
      visemeDurations: [actualDuration * 1000],
      estimatedDuration: actualDuration,
      isSynchronized: true
    };
  }
  
  // Calculate total duration accounting for speed adjustments
  const totalDurationMs = actualDuration * 1000;
  
  // Account for natural speech patterns and speed rate
  const speedFactor = speedRate / 100;
  const pauseFactorMs = Math.max(50, 150 / speedFactor); // Pause between words (50-300ms)
  
  // Calculate available time for actual word pronunciation
  const totalPauseTime = (words.length - 1) * pauseFactorMs;
  const availableWordTime = Math.max(100, totalDurationMs - totalPauseTime);
  
  let currentTime = 0;
  const wordTimes = [];
  const wordDurations = [];
  const visemes = [];
  const visemeTimes = [];
  const visemeDurations = [];
  
  // Calculate syllable-based word durations for more natural timing
  const getWordDuration = (word, baseTime) => {
    const syllableCount = Math.max(1, word.toLowerCase().match(/[aeiouy]+/g)?.length || 1);
    const lengthFactor = Math.max(0.5, Math.min(2.0, word.length / 4));
    const syllableFactor = Math.max(0.8, Math.min(1.5, syllableCount));
    
    // Combine factors for more natural timing
    const duration = baseTime * lengthFactor * syllableFactor;
    
    // Apply minimum and maximum durations for speech clarity
    return Math.max(150, Math.min(1500, duration));
  };
  
  // Enhanced viseme mapping for better lip-sync
  const getVisemeForWord = (word) => {
    const lowerWord = word.toLowerCase();
    const firstChar = lowerWord.charAt(0);
    
    const visemeMap = {
      // Bilabials (lips together)
      'p': 'PP', 'b': 'PP', 'm': 'PP',
      // Labiodentals (lip to teeth)
      'f': 'FF', 'v': 'FF',
      // Dentals/Alveolars (tongue to teeth/roof)
      't': 'DD', 'd': 'DD', 'n': 'DD', 'l': 'DD',
      // Sibilants (hissing sounds)
      's': 'SS', 'z': 'SS', 'c': 'SS',
      // Liquids
      'r': 'RR',
      // Velars (back of tongue)
      'k': 'kk', 'g': 'kk', 'q': 'kk',
      // Vowels (mouth shapes)
      'a': 'aa', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U'
    };
    
    // Get base viseme from first character
    let viseme = visemeMap[firstChar] || 'aa';
    
    // Override for common phonetic patterns
    if (lowerWord.includes('th')) viseme = 'TH';
    else if (lowerWord.includes('sh') || lowerWord.includes('ch')) viseme = 'SS';
    else if (lowerWord.includes('oo') || lowerWord.includes('ou')) viseme = 'U';
    else if (lowerWord.includes('ee') || lowerWord.includes('ea')) viseme = 'I';
    else if (lowerWord.includes('aw') || lowerWord.includes('au')) viseme = 'aa';
    
    return viseme;
  };
  
  // Calculate base time per word
  const baseWordTime = availableWordTime / words.length;
  
  words.forEach((word, index) => {
    const wordDuration = getWordDuration(word, baseWordTime);
    
    wordTimes.push(currentTime);
    wordDurations.push(wordDuration);
    
    // Generate 2-4 visemes per word based on syllables and length
    const syllableCount = Math.max(1, word.toLowerCase().match(/[aeiouy]+/g)?.length || 1);
    const wordVisemeCount = Math.max(2, Math.min(5, syllableCount + 1));
    const visemeDuration = wordDuration / wordVisemeCount;
    
    // Generate visemes with alternating patterns for more natural movement
    for (let i = 0; i < wordVisemeCount; i++) {
      let viseme;
      if (i === 0) {
        // First viseme matches word start
        viseme = getVisemeForWord(word);
      } else if (i === wordVisemeCount - 1) {
        // Last viseme closes the word (often neutral or matching word end)
        const lastChar = word.toLowerCase().charAt(word.length - 1);
        viseme = lastChar === 'm' || lastChar === 'n' ? 'PP' : 'aa';
      } else {
        // Middle visemes alternate for natural movement
        viseme = i % 2 === 1 ? 'aa' : getVisemeForWord(word);
      }
      
      visemes.push(viseme);
      visemeTimes.push(currentTime + (i * visemeDuration));
      visemeDurations.push(visemeDuration);
    }
    
    currentTime += wordDuration;
    
    // Add pause between words (except last word)
    if (index < words.length - 1) {
      currentTime += pauseFactorMs;
    }
  });
  
  // Final timing adjustment to match actual duration
  if (currentTime > 0 && Math.abs(currentTime - totalDurationMs) > 100) {
    const scaleFactor = totalDurationMs / currentTime;
    console.log(`⏱️ Scaling lip sync timing by ${scaleFactor.toFixed(3)} (${currentTime}ms -> ${totalDurationMs}ms)`);
    
    // Scale all timings proportionally
    for (let i = 0; i < wordTimes.length; i++) {
      wordTimes[i] *= scaleFactor;
      wordDurations[i] *= scaleFactor;
    }
    for (let i = 0; i < visemeTimes.length; i++) {
      visemeTimes[i] *= scaleFactor;
      visemeDurations[i] *= scaleFactor;
    }
  }
  
  console.log(`💋 Generated lip sync: ${words.length} words, ${visemes.length} visemes, ${actualDuration}s duration`);
  
  return {
    words: words,
    wordTimes: wordTimes,
    wordDurations: wordDurations,
    visemes: visemes,
    visemeTimes: visemeTimes,
    visemeDurations: visemeDurations,
    estimatedDuration: actualDuration,
    isSynchronized: true,
    speedRate: speedRate
  };
}

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'RPM-HCC TTS API Running!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;