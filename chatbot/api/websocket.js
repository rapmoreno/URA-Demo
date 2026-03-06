// RPM-HCC: WebSocket Handler for Real-time Chat
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const ModelProviderManager = require('./ModelProviderManager');

class ChatbotWebSocket {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.conversations = new Map();
        this.systemPrompt = '';
        
        // Initialize Model Provider Manager
        this.modelManager = new ModelProviderManager();

        this.loadSystemPrompt();
        this.setupWebSocket();
    }

    async loadSystemPrompt() {
        try {
            const promptPath = path.join(__dirname, '..', 'prompts.md');
            this.systemPrompt = await fs.readFile(promptPath, 'utf8');
            console.log('✅ WebSocket: System prompt loaded');
        } catch (error) {
            console.error('❌ WebSocket: Failed to load system prompt:', error.message);
            this.systemPrompt = 'You are a helpful AI assistant with avatar integration.';
        }
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log('🔌 New WebSocket connection');
            
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleMessage(ws, data);
                } catch (error) {
                    console.error('❌ WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'Invalid message format'
                    }));
                }
            });

            ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
            });

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connected',
                message: 'WebSocket connected successfully'
            }));
        });
    }

    async handleMessage(ws, data) {
        const { type, message, conversationId = 'ws-default', memoryContext = '' } = data;

        switch (type) {
            case 'chat':
                await this.handleChatMessage(ws, message, conversationId, memoryContext);
                break;
            case 'clear':
                this.clearConversation(conversationId);
                ws.send(JSON.stringify({
                    type: 'cleared',
                    conversationId
                }));
                break;
            case 'reload_prompt':
                await this.loadSystemPrompt();
                ws.send(JSON.stringify({
                    type: 'prompt_reloaded',
                    success: true
                }));
                break;
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    error: 'Unknown message type'
                }));
        }
    }

    async handleChatMessage(ws, message, conversationId, memoryContext = '') {
        if (!message || typeof message !== 'string') {
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Message is required'
            }));
            return;
        }

        try {
            // Get or create conversation history
            if (!this.conversations.has(conversationId)) {
                this.conversations.set(conversationId, []);
            }
            const history = this.conversations.get(conversationId);

            // Add user message to history
            history.push({ role: 'user', content: message });

            // Keep conversation history manageable
            if (history.length > 20) {
                history.splice(0, history.length - 20);
            }

            // Send typing indicator
            ws.send(JSON.stringify({
                type: 'typing',
                status: true
            }));
            
            // Check if current provider is Claude and if this might use knowledge base
            const currentProvider = this.modelManager.getCurrentProvider();
            const isClaudeProvider = currentProvider.getName() === 'Claude';
            
            // Send knowledge base indicator if we detect library-related keywords
            const libraryKeywords = ['library', 'membership', 'card', 'hours', 'services', 'database', 'fine', 'borrow', 'reserve', 'renew', 'print'];
            const containsLibraryKeywords = libraryKeywords.some(keyword => 
                message.toLowerCase().includes(keyword)
            );
            
            // Check if this might trigger catalogue search
            const catalogueKeywords = ['book', 'novel', 'author', 'read', 'magazine', 'dvd', 'cd', 'ebook', 'catalogue', 'search', 'find', 'material', 'item', 'collection', 'title'];
            const containsCatalogueKeywords = catalogueKeywords.some(keyword => 
                message.toLowerCase().includes(keyword)
            );
            
            // Check if this might trigger events search
            const eventsKeywords = ['event', 'events', 'program', 'programmes', 'workshop', 'activities', 'storytelling', 'schedule', 'calendar', 'activity', 'class', 'session'];
            const containsEventsKeywords = eventsKeywords.some(keyword => 
                message.toLowerCase().includes(keyword)
            );
            
            // Create callbacks for knowledge base and catalogue events
            const callbacks = {
                onKnowledgeBaseStart: () => {
                    console.log('🧠 Knowledge base search starting - showing thinking bubble');
                    ws.send(JSON.stringify({
                        type: 'knowledge_base_thinking',
                        status: true,
                        message: 'give me a moment while i check'
                    }));
                },
                onKnowledgeBaseSearching: (question) => {
                    console.log('🔍 Knowledge base searching:', question);
                    ws.send(JSON.stringify({
                        type: 'knowledge_base_thinking',
                        status: true,
                        message: 'give me a moment while i check'
                    }));
                },
                onCatalogueSearching: (query) => {
                    console.log('📚 Catalogue searching:', query);
                    ws.send(JSON.stringify({
                        type: 'catalogue_thinking',
                        status: true,
                        message: 'let me check our books'
                    }));
                },
                onEventsSearching: (query) => {
                    console.log('📅 Events searching:', query);
                    ws.send(JSON.stringify({
                        type: 'events_thinking',
                        status: true,
                        message: 'let me check the calendar'
                    }));
                },
                onKnowledgeBaseComplete: () => {
                    console.log('✅ Knowledge base search complete - keeping thinking bubble visible');
                    // Don't hide the bubble here - let it stay visible until TTS starts
                    // The bubble will be hidden by the response handler with a delay
                }
            };

            // Add memory context to system prompt if provided
            let enhancedPrompt = this.systemPrompt;
            if (memoryContext) {
                enhancedPrompt = this.systemPrompt + memoryContext;
                console.log('🧠 WebSocket: Browser memory context added to prompt');
            }

            // Use ModelProviderManager to send message with callbacks
            const result = await this.modelManager.sendMessage(message, conversationId, enhancedPrompt, history, callbacks);

            if (result.success) {
                // Add response to history
                history.push({ role: 'assistant', content: result.response });

                // Send response back to client with knowledge base, catalogue, and events flags
                ws.send(JSON.stringify({
                    type: 'response',
                    response: result.response,
                    avatarEmoji: result.avatarEmoji,
                    conversationId: conversationId,
                    usedKnowledgeBase: result.usedKnowledgeBase || false,
                    usedCatalogue: result.usedCatalogue || false,
                    usedEvents: result.usedEvents || false,
                    provider: result.provider,
                    timestamp: result.timestamp
                }));
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    error: result.response || 'Failed to get response',
                    details: result.error
                }));
            }

        } catch (error) {
            console.error('❌ WebSocket API Error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Failed to process request',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }));
        }
    }

    clearConversation(conversationId) {
        if (this.conversations.has(conversationId)) {
            this.conversations.delete(conversationId);
        }
    }

    broadcast(message) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

module.exports = ChatbotWebSocket;
