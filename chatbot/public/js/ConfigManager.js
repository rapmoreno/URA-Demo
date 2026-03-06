export class ConfigManager {
  constructor() {
    // Default configuration
    this.config = {
      avatarUrl: 'https://models.readyplayer.me/68c431b7c036016545e47f62.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
      voiceId: 'auto'  // Use 'auto' to enable automatic language detection and voice switching
    };
  }

  // =====================================================
  // CONFIGURATION LOADING
  // =====================================================
  async loadConfig() {
    try {
      const response = await fetch('/api/config');
      const serverConfig = await response.json();
      this.config.avatarUrl = serverConfig.avatarUrl;
      this.config.voiceId = serverConfig.voiceId;
      console.log('✅ Configuration loaded:', this.config);
      return true;
    } catch (error) {
      console.warn('⚠️ Failed to load config from server, using defaults:', error);
      return false;
    }
  }

  // =====================================================
  // GETTERS
  // =====================================================
  getConfig() {
    return { ...this.config }; // Return a copy to prevent direct mutations
  }

  getAvatarUrl() {
    return this.config.avatarUrl;
  }

  getVoiceId() {
    return this.config.voiceId;
  }

  // =====================================================
  // SETTERS
  // =====================================================
  setAvatarUrl(url) {
    this.config.avatarUrl = url;
  }

  setVoiceId(voiceId) {
    this.config.voiceId = voiceId;
  }

  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  // =====================================================
  // VALIDATION
  // =====================================================
  isValidConfig() {
    return (
      this.config.avatarUrl && 
      typeof this.config.avatarUrl === 'string' &&
      this.config.voiceId && 
      typeof this.config.voiceId === 'string'
    );
  }

  // =====================================================
  // RESET TO DEFAULTS
  // =====================================================
  resetToDefaults() {
    this.config = {
      avatarUrl: 'https://models.readyplayer.me/68c431b7c036016545e47f62.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
      voiceId: 'Jasmine'
    };
    console.log('🔄 Configuration reset to defaults');
  }
} 