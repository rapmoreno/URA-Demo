// GroqProvider.js - Groq implementation
const { Groq } = require('groq-sdk');

class GroqProvider {
  constructor() {
    this.name = 'Groq';
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  /**
   * Check if the provider is properly configured
   */
  isConfigured() {
    return !!process.env.GROQ_API_KEY;
  }

  /**
   * Send a message to Groq and return standardized response
   */
  async sendMessage(message, conversationId, systemPrompt, history, callbacks = {}) {
    try {
      // Convert history to Groq format
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      // Send request to Groq
      const completion = await this.groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
      });

      const response = completion.choices[0].message.content;

      // Extract emoji for avatar control
      const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
      const emojis = response.match(emojiRegex) || [];
      const avatarEmoji = emojis[0] || '😐'; // Default to neutral if no emoji found

      return {
        success: true,
        response: response,
        avatarEmoji: avatarEmoji,
        conversationId: conversationId,
        usage: {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens
        },
        provider: 'groq',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Groq Provider Error:', error);
      throw error;
    }
  }

  /**
   * Get provider-specific health information
   */
  getHealthInfo() {
    return {
      model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
      service: 'Groq API',
      requires: ['GROQ_API_KEY'],
      optional: ['GROQ_MODEL']
    };
  }

  /**
   * Get provider name
   */
  getName() {
    return this.name;
  }
}

module.exports = GroqProvider; 