// ClaudeProvider.js - Claude AI implementation via AWS Bedrock
const { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const MemoryParser = require('../memory-parser');

class ClaudeProvider {
  constructor() {
    this.name = 'Claude';
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'ap-southeast-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.memoryParser = new MemoryParser();
  }

  /**
   * Check if the provider is properly configured
   */
  isConfigured() {
    return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  }

  /**
   * Send a message to Claude and return standardized response
   */
  async sendMessage(message, conversationId, systemPrompt, history, callbacks = {}) {
    try {
      // Prepare messages for the converse API
      const messages = history.map(msg => ({
        role: msg.role,
        content: [{ text: msg.content }]
      }));

      // Claude request without complex tool support (using marker-based approach)
      const converseParams = {
        modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
        messages: messages,
        system: [{ text: systemPrompt }],
        inferenceConfig: {
          maxTokens: 1500,
          temperature: 0.7,
          topP: 0.9
        }
      };

      console.log('🤖 Sending message to Claude with memory parsing');
      let response = await this.client.send(new ConverseCommand(converseParams));
      
      // Process response
      const claudeResponse = response.output.message.content[0].text;
      
      // Parse and execute memory commands
      const memoryCommands = this.memoryParser.parseAndExecuteMemoryCommands(claudeResponse, conversationId);
      if (memoryCommands.length > 0) {
        console.log('🧠 Found memory commands:', memoryCommands.map(c => c.type));
        await this.memoryParser.executeMemoryCommands(memoryCommands);
      }
      
      // Clean response by removing memory markers
      const cleanResponse = this.memoryParser.cleanResponse(claudeResponse);
      
      // Extract emoji for avatar control from clean response
      const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
      const emojis = cleanResponse.match(emojiRegex) || [];
      const avatarEmoji = emojis[0] || this.getContextualEmoji(cleanResponse, history);

      return {
        success: true,
        response: cleanResponse,
        avatarEmoji: avatarEmoji,
        conversationId: conversationId,
        provider: 'claude',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Claude Provider Error:', error);
      throw error;
    }
  }



  /**
   * Get provider-specific health information
   */
  getHealthInfo() {
    return {
      model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      region: process.env.AWS_REGION || 'ap-southeast-1',
      service: 'AWS Bedrock',
      requires: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION']
    };
  }

  /**
   * Get contextual emoji based on response content and conversation history
   */
  getContextualEmoji(response, history = []) {
    const lowerResponse = response.toLowerCase();
    
    // Check if this is a greeting (first message or contains greeting words)
    const isFirstMessage = !history || history.length <= 1;
    const greetingWords = ['hello', 'hi', 'welcome', 'good morning', 'good afternoon', 'good evening', 'greetings'];
    const containsGreeting = greetingWords.some(word => lowerResponse.includes(word));
    
    if (isFirstMessage || containsGreeting) {
      console.log('🎭 Context: Detected greeting, using 🤝');
      return '🤝';
    }
    
    // Check for thinking/processing context
    if (lowerResponse.includes('let me') || lowerResponse.includes('checking') || lowerResponse.includes('looking') || lowerResponse.includes('searching')) {
      console.log('🎭 Context: Detected thinking, using ⚡');
      return '⚡';
    }
    
    // Check for positive/helpful responses
    if (lowerResponse.includes('great') || lowerResponse.includes('excellent') || lowerResponse.includes('perfect') || lowerResponse.includes('wonderful')) {
      console.log('🎭 Context: Detected enthusiasm, using 🚀');
      return '🚀';
    }
    
    // Check for questions/uncertainty
    if (response.includes('?') || lowerResponse.includes('not sure') || lowerResponse.includes('clarify')) {
      console.log('🎭 Context: Detected question/uncertainty, using 🤔');
      return '🤔';
    }
    
    // Check for apologies or problems
    if (lowerResponse.includes('sorry') || lowerResponse.includes('apologize') || lowerResponse.includes('unfortunately')) {
      console.log('🎭 Context: Detected apology, using 🥺');
      return '🥺';
    }
    
    // Check for thanks or appreciation
    if (lowerResponse.includes('thank') || lowerResponse.includes('appreciate') || lowerResponse.includes('you\'re welcome')) {
      console.log('🎭 Context: Detected gratitude, using 👍');
      return '👍';
    }
    
    // Check for dance/music/celebration
    if (lowerResponse.includes('dance') || lowerResponse.includes('music') || lowerResponse.includes('party') || lowerResponse.includes('celebration')) {
      console.log('🎭 Context: Detected dance/music, using 💃');
      return '💃';
    }
    
    // Default to neutral happy expression instead of awkward
    console.log('🎭 Context: No specific context detected, using default 😊');
    return '😊';
  }

  /**
   * Get provider name
   */
  getName() {
    return this.name;
  }
}

module.exports = ClaudeProvider;
