// OpenAIProvider.js - OpenAI GPT implementation
const OpenAI = require('openai');
const MemoryParser = require('../memory-parser');

class OpenAIProvider {
  constructor() {
    this.name = 'OpenAI';
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.memoryParser = new MemoryParser();
  }

  /**
   * Check if the provider is properly configured
   */
  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Send a message to OpenAI and return standardized response
   */
  async sendMessage(message, conversationId, systemPrompt, history, callbacks = {}) {
    try {
      // Convert history to OpenAI format
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      // Send request to OpenAI
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
      });

      const rawResponse = completion.choices[0].message.content;

      console.log('🤖 OpenAI raw response received');
      console.log('📝 Raw response content:', rawResponse);
      
      // Parse and execute memory commands
      const memoryCommands = this.memoryParser.parseAndExecuteMemoryCommands(rawResponse, conversationId);
      if (memoryCommands.length > 0) {
        console.log('🧠 Found memory commands:', memoryCommands.map(c => c.type));
        await this.memoryParser.executeMemoryCommands(memoryCommands);
      }
      
      // Clean response by removing memory markers
      const cleanResponse = this.memoryParser.cleanResponse(rawResponse);

      // Extract emoji for avatar control from clean response
      const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
      const emojis = cleanResponse.match(emojiRegex) || [];
      const avatarEmoji = emojis[0] || '😐'; // Default to neutral if no emoji found

      return {
        success: true,
        response: cleanResponse,
        avatarEmoji: avatarEmoji,
        conversationId: conversationId,
        usage: {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens
        },
        provider: 'openai',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ OpenAI Provider Error:', error);
      throw error;
    }
  }

  /**
   * Get provider-specific health information
   */
  getHealthInfo() {
    return {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      service: 'OpenAI API',
      requires: ['OPENAI_API_KEY'],
      optional: ['OPENAI_MODEL']
    };
  }

  /**
   * Get provider name
   */
  getName() {
    return this.name;
  }
}

module.exports = OpenAIProvider; 