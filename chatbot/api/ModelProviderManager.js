// ModelProviderManager.js - Unified interface for different AI model providers
const ClaudeProvider = require('./providers/ClaudeProvider');
const OpenAIProvider = require('./providers/OpenAIProvider');
// const GroqProvider = require('./providers/GroqProvider'); // DISABLED

class ModelProviderManager {
  constructor() {
    this.providers = {
      'claude': new ClaudeProvider(),
      'openai': new OpenAIProvider(),
      // 'groq': new GroqProvider() // DISABLED
    };
    
    // Default provider (can be set via environment variable)
    this.currentProvider = process.env.PRIMARY_PROVIDER || 'openai'; // Default to OpenAI
  }

  /**
   * Get the current active provider
   */
  getCurrentProvider() {
    return this.providers[this.currentProvider];
  }

  /**
   * Switch to a different provider
   */
  switchProvider(providerName) {
    if (!this.providers[providerName]) {
      throw new Error(`Provider ${providerName} not supported. Available: ${Object.keys(this.providers).join(', ')}`);
    }
    this.currentProvider = providerName;
    console.log(`🔄 Switched to ${providerName} provider`);
  }

  /**
   * Send a chat message using the current provider
   * All providers must implement this standardized interface
   */
  async sendMessage(message, conversationId, systemPrompt, history, callbacks = {}) {
    const provider = this.getCurrentProvider();
    
    if (!provider.isConfigured()) {
      return {
        success: false,
        response: `${this.currentProvider} provider is not properly configured. Please check your API credentials.`,
        avatarEmoji: '⚠️',
        isDemo: true
      };
    }

    try {
      return await provider.sendMessage(message, conversationId, systemPrompt, history, callbacks);
    } catch (error) {
      console.error(`❌ ${this.currentProvider} Provider Error:`, error);
      return {
        success: false,
        response: `Sorry, I'm having trouble connecting to ${this.currentProvider}. Please try again.`,
        avatarEmoji: '😞',
        error: error.message
      };
    }
  }

  /**
   * Get provider-specific health status
   */
  getProviderHealth() {
    const provider = this.getCurrentProvider();
    return {
      name: this.currentProvider,
      configured: provider.isConfigured(),
      status: provider.isConfigured() ? 'operational' : 'missing_credentials',
      ...provider.getHealthInfo()
    };
  }

  /**
   * Get list of all available providers
   */
  getAvailableProviders() {
    return Object.keys(this.providers).map(name => ({
      name,
      configured: this.providers[name].isConfigured(),
      current: name === this.currentProvider
    }));
  }
}

module.exports = ModelProviderManager; 