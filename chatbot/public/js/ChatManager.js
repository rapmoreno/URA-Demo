export class ChatManager {
  constructor() {
    this.conversationId = this.getOrCreateConversationId();
    this.autoSpeak = true;
    this.lastUserMessage = '';
    
    // Dependencies (set via dependency injection)
    this.webSocketManager = null;
    this.uiManager = null;
    this.idleTimerManager = null;
    this.ttsManager = null;
    this.emojiManager = null;
    this.bookCoverManager = null;
    this.leadershipManager = null;
    this.linkButtonManager = null;
    this.animationManager = null;
    
    // Avatar dependencies
    this.head = null;
    this.isLoaded = null;
  }

  // =====================================================
  // SETUP AND CONFIGURATION
  // =====================================================
  setDependencies({ 
    webSocketManager, 
    uiManager, 
    idleTimerManager, 
    ttsManager, 
    emojiManager, 
    bookCoverManager,
    leadershipManager,
    linkButtonManager,
    head,
    isLoaded,
    animationManager
  }) {
    this.webSocketManager = webSocketManager;
    this.uiManager = uiManager;
    this.idleTimerManager = idleTimerManager;
    this.ttsManager = ttsManager;
    this.emojiManager = emojiManager;
    this.bookCoverManager = bookCoverManager;
    this.leadershipManager = leadershipManager;
    this.linkButtonManager = linkButtonManager;
    this.head = head;
    this.isLoaded = isLoaded;
    this.animationManager = animationManager;
  }

  // =====================================================
  // CHAT MESSAGE HANDLING
  // =====================================================
  
  // Send a programmatic message (for auto-greeting)
  async sendProgrammaticMessage(messageText) {
    if (this.uiManager?.getIsLoading()) return;
    
    // Interrupt current speech if speaking
    if (this.ttsManager) {
      this.ttsManager.interruptSpeech();
    }

    const message = messageText.trim();
    if (!message) return;

    // Store user message for voice control context
    this.lastUserMessage = message;
    
    // ================================
    // CONFETTI APPRECIATION DETECTION
    // ================================
    // Check if user message contains appreciation and trigger confetti
    if (window.confettiManager && window.CONFETTI_ENABLED) {
      window.confettiManager.detectAppreciation(message);
    }
    
    // Update TTS manager with the last user message
    if (this.ttsManager) {
      this.ttsManager.setLastUserMessage(message);
    }

    this.uiManager?.setLoading(true);
    
    // Reset idle timer on user interaction
    if (this.idleTimerManager) {
      this.idleTimerManager.resetIdleTimer();
    }
    
    this.uiManager?.updateClaudeStatus('Thinking...', 'thinking');
    try {
      // Use WebSocketManager for both WebSocket and HTTP fallback
      await this.webSocketManager?.sendChat(message, this.conversationId);
    } catch (error) {
      console.error('Error:', error);
      this.uiManager?.updateStatus('❌ Connection error. Please try again.');
      this.uiManager?.updateClaudeStatus('Error', 'error');
      this.uiManager?.setLoading(false);
    }
  }

  async sendMessage() {
    if (this.uiManager?.getIsLoading()) return;
    
    // Interrupt current speech if speaking
    if (this.ttsManager) {
      this.ttsManager.interruptSpeech();
    }

    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;

    // Store user message for voice control context
    this.lastUserMessage = message;
    
    // ================================
    // CONFETTI APPRECIATION DETECTION
    // ================================
    // Check if user message contains appreciation and trigger confetti
    if (window.confettiManager && window.CONFETTI_ENABLED) {
      window.confettiManager.detectAppreciation(message);
    }
    
    // Update TTS manager with the last user message
    if (this.ttsManager) {
      this.ttsManager.setLastUserMessage(message);
    }

    messageInput.value = '';
    this.uiManager?.setLoading(true);
    
    // Reset idle timer on user interaction
    if (this.idleTimerManager) {
      this.idleTimerManager.resetIdleTimer();
    }
    
    this.uiManager?.updateClaudeStatus('Thinking...', 'thinking');

    try {
      // Use WebSocketManager for both WebSocket and HTTP fallback
      await this.webSocketManager?.sendChat(message, this.conversationId);
    } catch (error) {
      console.error('Error:', error);
      this.uiManager?.updateStatus('❌ Connection error. Please try again.');
      this.uiManager?.updateClaudeStatus('Error', 'error');
      this.uiManager?.setLoading(false);
    }

    messageInput.focus();
  }

  handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // =====================================================
  // CLAUDE RESPONSE PROCESSING
  // =====================================================
  handleClaudeResponse(response, avatarEmoji, usedKnowledgeBase, catalogueData, usedEvents) {
    console.log('🎭 ChatManager.handleClaudeResponse called with:', {
      response: response.substring(0, 50) + '...',
      avatarEmoji,
      usedKnowledgeBase,
      catalogueData: catalogueData ? 'Has catalogue data' : 'No catalogue data',
      usedEvents: usedEvents || false,
      hasAnimationManager: !!this.animationManager
    });
    
    // 🚀 PRIORITY 1: START TTS IMMEDIATELY FOR FASTEST RESPONSE
    if (this.autoSpeak && this.head && this.isLoaded && this.ttsManager) {
      console.log('🎤 🚀 Starting TTS IMMEDIATELY (highest priority)');
      // Filter out bracketed content before speaking
      const filteredResponse = this.linkButtonManager ? 
        this.linkButtonManager.filterBracketedContent(response) : 
        response;
      this.ttsManager.speakText(filteredResponse);
    }
    
    // PRIORITY 2: Visual processing can happen in parallel while TTS is generating
    
    // Update knowledge base thinking text if it was used
    if (usedKnowledgeBase && this.uiManager) {
      this.uiManager.updateKnowledgeBaseThinkingText('Preparing response...');
    }
    
    // Trigger context-aware animation based on response content (parallel to TTS)
    if (this.animationManager) {
      console.log('🎭 Calling animationManager.analyzeAndTrigger (parallel to TTS)');
      this.animationManager.analyzeAndTrigger(response);
    } else {
      console.warn('🎭 AnimationManager not available in ChatManager');
    }
    
    // Trigger avatar action based on emoji (parallel to TTS)
    if (avatarEmoji && this.emojiManager && this.emojiManager.hasEmojiAction(avatarEmoji) && this.head && this.isLoaded) {
      this.emojiManager.triggerEmojiAction(avatarEmoji);
    }
    
    // Handle book covers - DEACTIVATED FOR DEMO
    // Skip book thumbnails if this was an events-related response
    // if (this.bookCoverManager && !usedEvents) {
    //   if (catalogueData && catalogueData.results && catalogueData.results.length > 0) {
    //     console.log('📚 Using official catalogue data for book covers (parallel to TTS)');
    //     this.showCatalogueBooks(catalogueData);
    //   } else {
    //     console.log('📚 Falling back to text analysis for book covers (parallel to TTS)');
    //     this.bookCoverManager.processTextForBooks(response);
    //   }
    // } else if (usedEvents) {
    //   console.log('📅 Skipping book thumbnails - this was an events response');
    // }
    console.log('📚 Book cover display DEACTIVATED for demo');
    
    // Handle leadership displays - DEACTIVATED FOR DEMO
    // if (this.leadershipManager) {
    //   console.log('👥 Processing text for leadership mentions (parallel to TTS)');
    //   this.leadershipManager.processTextForLeadership(response);
    // }
    console.log('👥 Leadership photo display DEACTIVATED for demo');
    
    // Handle link buttons (parallel to TTS)
    if (this.linkButtonManager) {
      console.log('🔗 Processing text for link buttons (parallel to TTS)');
      this.linkButtonManager.processTextForLinks(response);
    }
  }
  
  // =====================================================
  // CATALOGUE BOOK DISPLAY
  // =====================================================
  showCatalogueBooks(catalogueData) {
    console.log('📚 Showing catalogue books:', catalogueData);
    
    if (!catalogueData.results || catalogueData.results.length === 0) {
      console.log('❌ No catalogue results to display');
      return;
    }
    
    const books = catalogueData.results.map(book => ({
      coverUrl: book.coverUrl,
      title: book.title,
      author: book.author,
      availableAtBishan: book.availableAtBishan
    })).filter(book => book.coverUrl); // Only show books with covers
    
    if (books.length === 0) {
      console.log('❌ No books with covers found');
      return;
    }
    
    if (books.length === 1) {
      // Show single book
      const book = books[0];
      console.log('📚 Showing single book:', book.title);
      this.bookCoverManager.showBookCover({
        coverUrl: book.coverUrl,
        title: book.title,
        author: book.author
      }, book.availableAtBishan ? 'Available at Bishan' : 'NLB Collection');
    } else {
      // Show multiple books
      console.log(`📚 Showing ${books.length} books`);
      this.bookCoverManager.showMultipleBookCovers(
        books,
        'Found in NLB Catalogue'
      );
    }
  }

  // =====================================================
  // CONVERSATION MANAGEMENT
  // =====================================================
  getOrCreateConversationId() {
    // Try to get existing conversation ID from localStorage
    let conversationId = localStorage.getItem('chatbot_conversation_id');
    
    if (!conversationId) {
      // Create new conversation ID if none exists
      conversationId = 'claude-' + Date.now();
      localStorage.setItem('chatbot_conversation_id', conversationId);
      console.log('🆔 Created new conversation ID:', conversationId);
    } else {
      console.log('🆔 Using existing conversation ID:', conversationId);
    }
    
    return conversationId;
  }

  async clearChat() {
    try {
      await this.webSocketManager?.clearChat(this.conversationId);
      
      // Clear browser memory
      if (typeof BrowserMemory !== 'undefined' && BrowserMemory && BrowserMemory.initialized) {
        try {
          BrowserMemory.clearSession();
          console.log('🧠 Browser memory cleared');
        } catch (error) {
          console.warn('⚠️ Failed to clear browser memory session:', error);
        }
      }
      
      this.uiManager?.updateStatus('👋 Chat cleared! Claude is ready for a new conversation.');
      
      // Create new conversation ID and save it
      this.conversationId = 'claude-' + Date.now();
      localStorage.setItem('chatbot_conversation_id', this.conversationId);
      console.log('🆔 Chat cleared, new conversation ID:', this.conversationId);
      
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
  }

  async reloadPrompt() {
    try {
      const response = await fetch('/api/reload-prompt', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.uiManager?.updateClaudeStatus('Prompt Reloaded', 'success');
        this.uiManager?.updateStatus('🔄 System prompt reloaded successfully!');
      } else {
        this.uiManager?.updateClaudeStatus('Reload Failed', 'error');
      }
      
    } catch (error) {
      console.error('Failed to reload prompt:', error);
      this.uiManager?.updateClaudeStatus('Reload Error', 'error');
    }
  }

  // =====================================================
  // AUTO-SPEAK MANAGEMENT
  // =====================================================
  toggleAutoSpeak() {
    this.autoSpeak = !this.autoSpeak;
    this.uiManager?.updateClaudeStatus(this.autoSpeak ? 'Auto-Speak ON' : 'Auto-Speak OFF', 'success');
    
    setTimeout(() => {
      this.uiManager?.updateClaudeStatus('Ready', 'success');
    }, 2000);
  }

  setAutoSpeak(enabled) {
    this.autoSpeak = enabled;
  }

  getAutoSpeak() {
    return this.autoSpeak;
  }

  // =====================================================
  // GETTERS AND SETTERS
  // =====================================================
  getConversationId() {
    return this.conversationId;
  }

  setConversationId(id) {
    this.conversationId = id;
  }

  getLastUserMessage() {
    return this.lastUserMessage;
  }

  setLastUserMessage(message) {
    this.lastUserMessage = message;
  }

  // =====================================================
  // INITIALIZATION AND SETUP
  // =====================================================
  init() {
    // Focus on input when initialized
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.focus();
    }
  }

  // =====================================================
  // INPUT HANDLING
  // =====================================================
  setupKeyboardHandlers() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.addEventListener('keypress', (event) => {
        this.handleKeyPress(event);
      });
    }
  }

  focusInput() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.focus();
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================
  getConnectionStatus() {
    return this.webSocketManager?.getConnectionStatus() || 'unknown';
  }

  isConnected() {
    return this.webSocketManager?.isAvailable() || false;
  }

  // =====================================================
  // CLEANUP
  // =====================================================
  cleanup() {
    // Clean up event listeners if needed
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      // Remove event listeners
      messageInput.removeEventListener('keypress', this.handleKeyPress);
    }
    
    // Reset dependencies
    this.webSocketManager = null;
    this.uiManager = null;
    this.idleTimerManager = null;
    this.ttsManager = null;
    this.emojiManager = null;
    this.bookCoverManager = null;
    this.head = null;
    this.isLoaded = null;
    this.animationManager = null;
  }
} 