// RPM-HCC: Multi-Model AI Chatbot API with Avatar Integration
// AI call: agent ura_chatbot_faq, model from registry (OpenRouter+Groq), called from chatbot.js POST /chat
const express = require('express');
const path = require('path');
const { executeAgent, loadPrompt } = require(path.join(__dirname, '..', '..', 'orchestrator', 'agent_executor.js'));
const { loadRegistry, getAgent } = require(path.join(__dirname, '..', '..', 'orchestrator', 'registry_loader.js'));

const router = express.Router();
const AGENT_ID = 'ura_chatbot_faq';

let baseSystemPrompt = '';
async function loadSystemPrompt() {
    try {
        await loadRegistry();
        const agent = getAgent(AGENT_ID);
        if (!agent) throw new Error('Agent not found');
        const raw = await loadPrompt(agent.prompt_file);
        // Strip metadata header (lines until ---)
        const dashIndex = raw.indexOf('\n---\n');
        baseSystemPrompt = dashIndex >= 0 ? raw.slice(dashIndex + 5) : raw;
        console.log('✅ System prompt loaded from registry (prompts/ura_chatbot_faq.md)');
    } catch (error) {
        console.error('❌ Failed to load system prompt:', error.message);
        baseSystemPrompt = 'You are a helpful AI assistant with avatar integration.';
    }
}

// Build enhanced prompt with memory context - MEMORY FIRST!
async function buildEnhancedPrompt(conversationId) {
    const MemoryTools = require('./memory-tools');
    const memoryTools = new MemoryTools();
    
    try {
        const memoryResult = await memoryTools.executeTool('recall_user_memory', {
            conversation_id: conversationId
        });
        
        if (memoryResult.success && memoryResult.memory_found) {
            console.log(`🧠 Loading memory FIRST for conversation: ${conversationId}`);
            console.log(`🧠 Memory content:`, memoryResult.user_info);
            
            const enhancedPrompt = `<current_user_memory>
CRITICAL: You know this user from previous conversations:
${memoryResult.user_info}

Use this information to personalize your responses and show continuity. This memory takes priority over default settings.
</current_user_memory>

${baseSystemPrompt}`;
            
            console.log(`🧠 Enhanced prompt length:`, enhancedPrompt.length);
            console.log(`🧠 Enhanced prompt preview:`, enhancedPrompt.substring(0, 300) + '...');
            
            return enhancedPrompt;
        }
    } catch (error) {
        console.error('❌ Error loading memory:', error);
    }
    
    return baseSystemPrompt;
}


// Load prompt on startup
loadSystemPrompt();

// Conversation history storage (in production, use Redis/Database)
const conversations = new Map();

// Multi-model chat endpoint
router.post('/chat', async (req, res) => {
    try {
        const { message, conversationId = 'default', memoryContext = '' } = req.body;

        if (!message) {
            return res.status(400).json({ 
                error: 'Message is required',
                success: false 
            });
        }

        // Get or create conversation history
        if (!conversations.has(conversationId)) {
            conversations.set(conversationId, []);
        }
        const history = conversations.get(conversationId);

        // Add user message to history
        history.push({ role: 'user', content: message });

        // Keep conversation history manageable (last 20 messages)
        if (history.length > 20) {
            history.splice(0, history.length - 20);
        }

        // Build enhanced prompt with user memory
        let enhancedPrompt = await buildEnhancedPrompt(conversationId);
        
        // Add browser memory context if provided
        if (memoryContext) {
            enhancedPrompt = enhancedPrompt + memoryContext;
            console.log('🧠 Browser memory context added to prompt');
        }

        // Build messages for API (history includes the new user message)
        const apiMessages = history.map((m) => ({ role: m.role, content: m.content }));

        // AI call: agent ura_chatbot_faq, model from registry (meta-llama/llama-3.3-70b via OpenRouter+Groq)
        const apiResult = await executeAgent(AGENT_ID, enhancedPrompt, apiMessages);

        const result = apiResult.success
            ? { success: true, response: apiResult.response, avatarEmoji: apiResult.response?.match(/^\p{Emoji}/u)?.[0] ?? '😊' }
            : { success: false, response: apiResult.error ?? 'Failed to get response', avatarEmoji: '😞' };

        if (result.success) {
            history.push({ role: 'assistant', content: result.response });
        }

        res.json(result);

    } catch (error) {
        console.error('❌ AI Model API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get response from AI model',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Reload system prompt endpoint
router.post('/reload-prompt', async (req, res) => {
    try {
        await loadSystemPrompt();
        res.json({
            success: true,
            message: 'System prompt reloaded successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to reload system prompt',
            details: error.message
        });
    }
});

// Get current system prompt
router.get('/system-prompt', (req, res) => {
    res.json({
        success: true,
        prompt: baseSystemPrompt,
        length: baseSystemPrompt.length
    });
});

// Switch model provider - DEPRECATED: All agents use OpenRouter+Groq from registry
router.post('/switch-provider', (req, res) => {
    res.json({
        success: false,
        error: 'Provider switching disabled. All agents use OpenRouter + Groq from registry.',
    });
});

// Get available providers - returns registry info
router.get('/providers', async (req, res) => {
    try {
        await loadRegistry();
        const agent = getAgent(AGENT_ID);
        res.json({
            success: true,
            providers: [{ name: 'openrouter', configured: !!process.env.OPENROUTER_API_KEY, current: true }],
            currentProvider: { name: 'openrouter', configured: !!process.env.OPENROUTER_API_KEY, model: agent?.model }
        });
    } catch (e) {
        res.json({ success: false, providers: [] });
    }
});

// Clear conversation history
router.delete('/conversation/:id', (req, res) => {
    const { id } = req.params;
    if (conversations.has(id)) {
        conversations.delete(id);
        res.json({
            success: true,
            message: `Conversation ${id} cleared`
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'Conversation not found'
        });
    }
});

// Health check for chatbot
router.get('/chat-health', async (req, res) => {
    try {
        await loadRegistry();
        const agent = getAgent(AGENT_ID);
        res.json({
            success: true,
            service: 'RPM-HCC Multi-Model AI Chatbot (OpenRouter+Groq)',
            status: process.env.OPENROUTER_API_KEY ? 'operational' : 'missing_credentials',
            currentProvider: { name: 'openrouter', model: agent?.model },
            system_prompt_loaded: baseSystemPrompt.length > 0,
            active_conversations: conversations.size,
            memory_tools: 'enabled',
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
