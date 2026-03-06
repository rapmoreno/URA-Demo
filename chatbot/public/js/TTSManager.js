export class TTSManager {
  constructor() {
    this.isInitialized = false;
    this.audioContext = null;
    this.configManager = null;
    this.voiceStateManager = null;
    this.idleTimerManager = null;
    this.speechBubbleManager = null;
    this.animationManager = null;
    this.uiManager = null;
    this.head = null;
    this.isLoaded = false;
    this.lastUserMessage = '';
    
    // Interruption support
    this.currentAudioSource = null;
    this.isSpeaking = false;
    this.currentFallbackTimeout = null;
    this.currentMonitorInterval = null;
    this.cleanupCurrentTimers = null;
  }

  // =====================================================
  // INITIALIZATION AND DEPENDENCIES
  // =====================================================
  setDependencies(head, isLoaded, configManager, voiceStateManager, idleTimerManager, speechBubbleManager, animationManager = null, uiManager = null) {
    this.head = head;
    this.isLoaded = isLoaded;
    this.configManager = configManager;
    this.voiceStateManager = voiceStateManager;
    this.idleTimerManager = idleTimerManager;
    this.speechBubbleManager = speechBubbleManager;
    this.animationManager = animationManager;
    this.uiManager = uiManager;
    this.isInitialized = true;
  }

  setLastUserMessage(message) {
    this.lastUserMessage = message;
  }

  // =====================================================
  // TEXT PREPROCESSING
  // =====================================================
  cleanTextForTTS(text) {
    // Remove emojis from text before sending to TTS (comprehensive emoji removal)
    const cleanText = text
      // Remove all emoji ranges
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Regional country flags
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
      .replace(/[\u{2000}-\u{206F}]/gu, '')   // General Punctuation (includes some emoji modifiers)
      .replace(/[\u{2190}-\u{21FF}]/gu, '')   // Arrows
      .replace(/[\u{2B50}\u{2B55}]/gu, '')    // Star and heavy large circle
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleanText;
  }

  // =====================================================
  // AUDIO PROCESSING
  // =====================================================
  async base64ToAudioBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
    return audioBuffer;
  }

  // =====================================================
  // TTS API COMMUNICATION
  // =====================================================
  async callTTSAPI(cleanText, useStreaming = false) {
    // Prefer enhanced endpoint with real speech marks for better accuracy
    // Only use streaming as fallback for performance when needed
    const endpoint = useStreaming ? '/api/tts-stream' : '/api/tts-enhanced';
    const requestBody = {
      text: cleanText,
      voice: this.configManager ? this.configManager.getVoiceId() : 'auto',
      sessionId: this.voiceStateManager ? this.voiceStateManager.getSessionId() : 'fallback-session',
      userMessage: this.lastUserMessage || ''
    };

    try {
      console.log(`🎤 Calling TTS API: ${endpoint} for "${cleanText.substring(0, 50)}..."`);
      console.log(`🔧 Voice parameter being sent: "${requestBody.voice}"`);
      console.log(`📝 Full request body:`, requestBody);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      // Enhanced error handling and fallback logic
      if (!data.success) {
        if (!useStreaming) {
          console.warn('🎤 Enhanced TTS failed, falling back to streaming TTS');
          return this.callTTSAPI(cleanText, true);
        } else {
          throw new Error(data.error || 'TTS API call failed');
        }
      }
      
      // Log timing accuracy info
      if (data.lipSync) {
        const timingType = data.streaming ? 'estimated' : 'precise';
        const syncInfo = data.lipSync.isSynchronized ? 'synchronized' : 'basic';
        console.log(`🎵 TTS Response: ${timingType} timing, ${syncInfo} lip sync, ${data.duration}s duration`);
      }
      
      return data;
    } catch (error) {
      // Only fallback to streaming if we weren't already using it
      if (!useStreaming) {
        console.warn('🎤 Enhanced TTS error, falling back to streaming TTS:', error.message);
        return this.callTTSAPI(cleanText, true);
      }
      throw error;
    }
  }

  // =====================================================
  // AUDIO OBJECT CREATION
  // =====================================================
  async createAudioObject(data) {
    const audioBuffer = await this.base64ToAudioBuffer(data.audio);
    
    return {
      audio: audioBuffer,
      words: data.lipSync.words,
      wtimes: data.lipSync.wordTimes,
      wdurations: data.lipSync.wordDurations,
      visemes: data.lipSync.visemes,
      vtimes: data.lipSync.visemeTimes,
      vdurations: data.lipSync.visemeDurations
    };
  }

  // =====================================================
  // SPEECH PLAYBACK WITH LIP-SYNC
  // =====================================================
  playSpeechWithLipSync(audioObject, cleanText, data) {
    if (!this.head || !this.isLoaded) {
      console.warn('Head or avatar not ready for speech');
      return;
    }
    
    // Mark as speaking
    this.isSpeaking = true;

    // Hide knowledge base thinking bubble immediately when TTS starts
    if (this.uiManager) {
      this.uiManager.hideKnowledgeBaseThinkingImmediate();
    }

    // Trigger talking animation when speech starts
    if (this.animationManager) {
      this.animationManager.onSpeechStart();
    }

    // Show speech bubble with timing data
    if (this.speechBubbleManager) {
      this.speechBubbleManager.showChunkedSpeechBubble(cleanText, data.lipSync.wordTimes, data.lipSync.words);
    }

    // Enhanced speech data logging for debugging
    const speechInfo = {
      duration: data.duration,
      wordCount: data.lipSync.words.length,
      visemeCount: data.lipSync.visemes?.length || 0,
      hasOnComplete: typeof this.head.speakAudio === "function",
      streaming: data.streaming || false,
      synchronized: data.lipSync.isSynchronized || false,
      timingType: data.streaming ? 'estimated' : 'precise',
      speedRate: data.lipSync.speedRate || 100,
      actualAudioDuration: data.duration,
      estimatedDuration: data.lipSync.estimatedDuration
    };
    
    console.log("🎤 Speech playback starting:", speechInfo);
    
    // Log lip sync timing details
    if (data.lipSync.wordTimes && data.lipSync.wordTimes.length > 0) {
      const firstWordTime = data.lipSync.wordTimes[0];
      const lastWordTime = data.lipSync.wordTimes[data.lipSync.wordTimes.length - 1];
      const lastWordDuration = data.lipSync.wordDurations[data.lipSync.wordDurations.length - 1] || 500;
      const totalLipSyncTime = lastWordTime + lastWordDuration;
      
      console.log("💋 Lip sync timing:", {
        firstWord: `"${data.lipSync.words[0]}" at ${firstWordTime}ms`,
        lastWord: `"${data.lipSync.words[data.lipSync.words.length - 1]}" at ${lastWordTime}ms`,
        totalLipSyncDuration: `${totalLipSyncTime}ms (${totalLipSyncTime/1000}s)`,
        audioDuration: `${data.duration * 1000}ms (${data.duration}s)`,
        timingDiff: `${Math.abs(totalLipSyncTime - (data.duration * 1000))}ms`
      });
    }

    // Record start time for monitoring
    const speechStartTime = Date.now();

    // Primary method: Use TalkingHead's onComplete callback (most reliable)
    this.head.speakAudio(audioObject, {
      lipsyncLang: "en",
      onComplete: () => {
        const actualDuration = Date.now() - speechStartTime;
        console.log(`🎤 Speech completed via onComplete callback after ${actualDuration}ms (expected: ${data.duration * 1000}ms)`);
        
        // Mark as not speaking
        this.isSpeaking = false;
        this.currentAudioSource = null;
        
        // Clean up our monitoring timers
        if (this.cleanupCurrentTimers) {
          this.cleanupCurrentTimers();
        }
        
        // Trigger animation when speech ends
        if (this.animationManager) {
          this.animationManager.onSpeechEnd();
        }
        
        // Clear any existing timeout and hide bubble after a delay when speech ends
        if (this.speechBubbleManager) {
          this.speechBubbleManager.clearAllTimers();
          // Keep bubble visible for 2 more seconds after speech ends
          setTimeout(() => {
            this.speechBubbleManager.hideSpeechBubble();
          }, 2000);
        }
      },
      onError: (error) => {
        console.error("🎤 Speech error:", error);
        
        // Mark as not speaking
        this.isSpeaking = false;
        this.currentAudioSource = null;
        
        // Clean up our monitoring timers
        if (this.cleanupCurrentTimers) {
          this.cleanupCurrentTimers();
        }
        
        // Trigger animation end on error too
        if (this.animationManager) {
          this.animationManager.onSpeechEnd();
        }
        
        // Hide bubble on speech error too
        if (this.speechBubbleManager) {
          this.speechBubbleManager.clearAllTimers();
          this.speechBubbleManager.hideSpeechBubble();
        }
      },
    });

    // Setup fallback timers with improved monitoring
    this.setupFallbackTimers(data.duration, speechStartTime);
  }

  // =====================================================
  // FALLBACK TIMER MANAGEMENT
  // =====================================================
  setupFallbackTimers(duration, speechStartTime) {
    const speechDuration = duration * 1000; // Convert to milliseconds
    
    // Fallback method: Timeout based on estimated duration (in case onComplete fails)
    console.log(`🎤 Setting timeout fallback for ${speechDuration + 1000}ms`);
    const fallbackTimeout = setTimeout(() => {
      const elapsed = Date.now() - speechStartTime;
      console.log(`🎤 Speech completed via timeout fallback after ${elapsed}ms (expected: ${speechDuration}ms)`);
      
      if (this.speechBubbleManager) {
        this.speechBubbleManager.clearAllTimers();
        // Keep bubble visible for 2 more seconds after speech ends
        setTimeout(() => {
          this.speechBubbleManager.hideSpeechBubble();
        }, 2000);
      }
    }, speechDuration + 1000); // Add 1 second buffer for safety

    // Enhanced monitoring method with better timing checks
    const startTime = speechStartTime;
    let monitoringActive = true;
    
    const monitorInterval = setInterval(() => {
      if (!monitoringActive) {
        clearInterval(monitorInterval);
        return;
      }
      
      const elapsed = Date.now() - startTime;
      const progressPercent = ((elapsed / speechDuration) * 100).toFixed(1);
      
      // Log progress every 2 seconds or at key milestones
      if (elapsed % 2000 < 1000 || progressPercent >= 90) {
        console.log(`🎤 Speech monitor: ${elapsed}ms elapsed (${progressPercent}% of ${speechDuration}ms)`);
      }

      // Check if we've exceeded expected duration significantly
      if (elapsed > speechDuration + 3000) {
        console.warn(`⚠️ Speech duration exceeded expectation by ${elapsed - speechDuration}ms`);
        clearInterval(monitorInterval);
        clearTimeout(fallbackTimeout);
        monitoringActive = false;
        
        if (this.speechBubbleManager) {
          this.speechBubbleManager.clearAllTimers();
          // Keep bubble visible for 2 more seconds after speech ends
          setTimeout(() => {
            this.speechBubbleManager.hideSpeechBubble();
          }, 2000);
        }
      }
    }, 1000); // Check every second
    
    // Store references for cleanup
    this.currentFallbackTimeout = fallbackTimeout;
    this.currentMonitorInterval = monitorInterval;
    
    // Cleanup function to be called when speech actually completes
    this.cleanupCurrentTimers = () => {
      monitoringActive = false;
      if (this.currentFallbackTimeout) {
        clearTimeout(this.currentFallbackTimeout);
        this.currentFallbackTimeout = null;
      }
      if (this.currentMonitorInterval) {
        clearInterval(this.currentMonitorInterval);
        this.currentMonitorInterval = null;
      }
    };
  }

  // =====================================================
  // SPEECH INTERRUPTION
  // =====================================================
  interruptSpeech() {
    if (!this.isSpeaking) {
      console.log('🔇 No speech to interrupt');
      return false;
    }
    
    console.log('🛑 Interrupting current speech');
    
    // Stop TalkingHead speech if possible
    if (this.head && this.head.stopSpeaking) {
      this.head.stopSpeaking();
    }
    
    // Stop current audio source if playing
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        console.log('🔇 Audio source stopped');
      } catch (error) {
        console.warn('⚠️ Could not stop audio source:', error);
      }
      this.currentAudioSource = null;
    }
    
    // Clean up timers
    if (this.cleanupCurrentTimers) {
      this.cleanupCurrentTimers();
    }
    
    // Clear speech bubble immediately
    if (this.speechBubbleManager) {
      this.speechBubbleManager.clearAllTimers();
      this.speechBubbleManager.hideSpeechBubble();
    }
    
    // Trigger animation end
    if (this.animationManager) {
      this.animationManager.onSpeechEnd();
    }
    
    // Reset speaking state
    this.isSpeaking = false;
    
    console.log('✅ Speech interrupted successfully');
    return true;
  }
  
  // =====================================================
  // MAIN SPEAK TEXT FUNCTION
  // =====================================================
  async speakText(text) {
    if (!this.head || !this.isLoaded) {
      console.warn('Avatar not ready for speech');
      return false;
    }

    // Reset idle timer when avatar starts speaking
    if (this.idleTimerManager) {
      this.idleTimerManager.resetIdleTimer();
    }

    // Clean text for TTS
    const cleanText = this.cleanTextForTTS(text);
    
    // Don't speak if only emojis were in the text
    if (!cleanText) {
      console.warn('No clean text to speak after emoji removal');
      return false;
    }

    try {
      // Call TTS API
      const data = await this.callTTSAPI(cleanText);
      
      if (data.success) {
        // Create audio object with lip-sync data
        const audioObject = await this.createAudioObject(data);
        
        // Play speech with lip-sync
        this.playSpeechWithLipSync(audioObject, cleanText, data);
        
        return true;
      } else {
        console.error('TTS API call failed:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Speech error:', error);
      if (this.speechBubbleManager) {
        this.speechBubbleManager.hideSpeechBubble(); // Hide bubble on error
      }
      return false;
    }
  }

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================
  // Note: base64ToAudioBuffer is already defined above in AUDIO PROCESSING section

  // =====================================================
  // STATUS AND GETTERS
  // =====================================================
  getIsInitialized() {
    return this.isInitialized;
  }

  getAudioContext() {
    return this.audioContext;
  }

  // =====================================================
  // AUDIO CONTEXT MANAGEMENT
  // =====================================================
  preWarmAudioContext() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('🔊 Audio context created for TTS');
      }
      
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('🔊 TTS Audio context resumed');
        }).catch(error => {
          console.warn('⚠️ Could not resume TTS audio context:', error);
        });
      }
    } catch (error) {
      console.warn('⚠️ Could not create/resume audio context:', error);
    }
  }

  // =====================================================
  // CONFIGURATION
  // =====================================================
  setVoice(voiceId) {
    if (this.configManager) {
      this.configManager.setVoiceId(voiceId);
    }
  }

  getVoice() {
    return this.configManager ? this.configManager.getVoiceId() : 'Jasmine';
  }

  // =====================================================
  // CLEANUP
  // =====================================================
  cleanup() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
  }
} 