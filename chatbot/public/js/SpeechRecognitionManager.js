export class SpeechRecognitionManager {
  constructor() {
    this.isRecording = false;
    this.recognition = null;
    this.recordingTimeout = null;
    this.onResultCallback = null;
    this.isSupported = this.checkSupport();
  }

  // =====================================================
  // SETUP AND CONFIGURATION
  // =====================================================
  checkSupport() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  setOnResultCallback(callback) {
    this.onResultCallback = callback;
  }

  // =====================================================
  // SPEECH RECOGNITION INITIALIZATION
  // =====================================================
  initSpeechRecognition() {
    if (!this.isSupported) {
      console.warn('Speech recognition not supported in this browser');
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    
    this.recognition.onstart = () => {
      console.log('🎤 Voice recognition started');
      this.updateMicButtonState(true);
    };
    
    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Call callback if provided, otherwise handle directly
      if (this.onResultCallback) {
        this.onResultCallback(finalTranscript, interimTranscript);
      } else {
        this.handleResult(finalTranscript, interimTranscript);
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('🎤 Voice recognition error:', event.error);
      this.stopVoiceRecognition();
    };
    
    this.recognition.onend = () => {
      console.log('🎤 Voice recognition ended');
      this.stopVoiceRecognition();
    };
    
    return true;
  }

  // =====================================================
  // DEFAULT RESULT HANDLER
  // =====================================================
  handleResult(finalTranscript, interimTranscript) {
    console.log('🎤 handleResult called:', { finalTranscript, interimTranscript });
    
    // Update input field with current transcript
    const messageInput = document.getElementById('messageInput');
    console.log('🎤 messageInput found:', !!messageInput);
    
    if (finalTranscript) {
      console.log('🎤 Final transcript received:', finalTranscript);
      messageInput.value = finalTranscript.trim();
      this.stopVoiceRecognition();
      // Auto-send after a short delay
      setTimeout(() => {
        if (messageInput.value.trim()) {
          console.log('🎤 Auto-sending message:', messageInput.value);
          // Trigger send message event
          if (window.sendMessage) {
            window.sendMessage();
          } else {
            console.error('🎤 window.sendMessage not found');
          }
        }
      }, 500);
    } else if (interimTranscript) {
      console.log('🎤 Interim transcript:', interimTranscript);
      messageInput.value = interimTranscript.trim();
    }
  }

  // =====================================================
  // VOICE RECOGNITION CONTROLS
  // =====================================================
  async startVoiceRecognition() {
    console.log('🎤 startVoiceRecognition called');
    
    // First, request microphone permission explicitly
    try {
      console.log('🎤 Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('🎤 Microphone permission granted');
      // Stop the stream immediately, we just needed permission
      stream.getTracks().forEach(track => track.stop());
    } catch (permissionError) {
      console.error('🎤 Microphone permission denied:', permissionError);
      alert('Microphone permission is required for voice input. Please allow microphone access and try again.');
      return false;
    }
    
    if (!this.recognition && !this.initSpeechRecognition()) {
      console.error('🎤 Voice recognition not supported or failed to initialize');
      alert('Voice recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return false;
    }
    
    console.log('🎤 Recognition object:', this.recognition);
    
    // Interrupt current speech if speaking
    if (window.ttsManager) {
      window.ttsManager.interruptSpeech();
    }
    
    if (!this.isRecording) {
      try {
        console.log('🎤 Starting recognition...');
        this.recognition.start();
        this.isRecording = true;
        console.log('🎤 Recognition started successfully');
        
        // Auto-stop after 10 seconds
        this.recordingTimeout = setTimeout(() => {
          console.log('🎤 Auto-stopping due to timeout');
          this.stopVoiceRecognition();
        }, 10000);
        
        return true;
      } catch (error) {
        console.error('🎤 Error starting voice recognition:', error);
        if (error.name === 'NotAllowedError') {
          alert('Microphone access was denied. Please allow microphone access in your browser settings and reload the page.');
        } else {
          alert('Error starting voice recognition: ' + error.message);
        }
        this.stopVoiceRecognition();
        return false;
      }
    } else {
      console.log('🎤 Already recording');
    }
    return false;
  }

  stopVoiceRecognition() {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
    }
    this.isRecording = false;
    this.updateMicButtonState(false);
    
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }
  }

  async toggleVoice() {
    console.log('🎤 toggleVoice called, isRecording:', this.isRecording);
    if (this.isRecording) {
      this.stopVoiceRecognition();
    } else {
      await this.startVoiceRecognition();
    }
  }

  // =====================================================
  // UI UPDATES
  // =====================================================
  updateMicButtonState(recording) {
    const micBtn = document.getElementById('micBtn');
    const micIcon = micBtn.querySelector('svg');
    
    if (!micBtn || !micIcon) return;
    
    if (recording) {
      micBtn.classList.add('recording');
      micBtn.title = 'Stop voice input';
      // Change to stop icon
      micIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" rx="2"/>';
    } else {
      micBtn.classList.remove('recording');
      micBtn.title = 'Voice input';
      // Change back to microphone icon
      micIcon.innerHTML = `
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      `;
    }
  }

  // =====================================================
  // GETTERS AND STATUS
  // =====================================================
  getIsRecording() {
    return this.isRecording;
  }

  getIsSupported() {
    return this.isSupported;
  }

  getRecognitionState() {
    return {
      isRecording: this.isRecording,
      isSupported: this.isSupported,
      hasRecognition: this.recognition !== null
    };
  }

  // =====================================================
  // CLEANUP
  // =====================================================
  cleanup() {
    this.stopVoiceRecognition();
    if (this.recognition) {
      this.recognition = null;
    }
  }

  // =====================================================
  // CONFIGURATION
  // =====================================================
  setLanguage(language = 'en-US') {
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  setTimeout(timeoutMs = 10000) {
    this.autoStopTimeout = timeoutMs;
  }
} 