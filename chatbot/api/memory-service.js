// Memory Analysis Service for Persistent User Memory
// AI call: agent ura_memory_analyzer, model from registry (OpenRouter+Groq), called from analyzeConversation
const fs = require('fs').promises;
const path = require('path');
const { executeAgent, loadPrompt } = require(path.join(__dirname, '..', '..', 'orchestrator', 'agent_executor.js'));
const { loadRegistry, getAgent } = require(path.join(__dirname, '..', '..', 'orchestrator', 'registry_loader.js'));

const MEMORY_AGENT_ID = 'ura_memory_analyzer';

class MemoryService {
    constructor() {
        this.memoryFilePath = path.join(__dirname, '..', 'prompt-persistent.md');
        this.analysisPrompt = `
You are a memory analyst AI. Analyze the conversation transcript and extract key information about the user.

Create bullet points about:
- User's name and personal details
- Their interests, hobbies, and preferences
- Their work/job information
- Family situation (spouse, children, etc.)
- Important dates or events they mentioned
- Their communication style and personality traits
- Any specific needs or requests they have
- Previous topics they've shown interest in

Format as markdown bullet points. Only include factual information mentioned in the conversation.
Be concise but comprehensive. Update existing information if new details are provided.

Previous user memory:
{previousMemory}

New conversation transcript:
{transcript}

Provide updated memory bullet points:`;
    }

    async getMemoryAnalyzerPrompt() {
        await loadRegistry();
        const agent = getAgent(MEMORY_AGENT_ID);
        if (!agent) return 'Extract user information from the conversation as bullet points.';
        const raw = await loadPrompt(agent.prompt_file);
        const dashIndex = raw.indexOf('\n---\n');
        return dashIndex >= 0 ? raw.slice(dashIndex + 5) : raw;
    }

    async analyzeConversation(conversationHistory, conversationId = 'default') {
        try {
            // Load existing memory
            const previousMemory = await this.loadMemory(conversationId);
            
            // Create transcript from conversation history
            const transcript = this.formatConversationTranscript(conversationHistory);
            
            // Skip analysis if transcript is too short
            if (transcript.length < 50) {
                return { success: true, message: 'Conversation too short for memory analysis' };
            }

            // Prepare analysis prompt
            const analysisPrompt = this.analysisPrompt
                .replace('{previousMemory}', previousMemory || 'No previous memory')
                .replace('{transcript}', transcript);

            // AI call: agent ura_memory_analyzer via OpenRouter+Groq
            const systemPrompt = await this.getMemoryAnalyzerPrompt();
            const result = await executeAgent(MEMORY_AGENT_ID, systemPrompt, [
                { role: 'user', content: analysisPrompt }
            ]);

            if (result.success && result.response) {
                await this.saveMemory(result.response.trim(), conversationId);
                return { 
                    success: true, 
                    message: 'Memory updated successfully',
                    memoryUpdate: result.response.substring(0, 200) + '...'
                };
            }

            return { success: false, error: 'Failed to analyze conversation' };
        } catch (error) {
            console.error('❌ Memory analysis error:', error);
            return { success: false, error: error.message };
        }
    }

    formatConversationTranscript(history) {
        return history.map(msg => {
            const role = msg.role === 'user' ? 'User' : 'Temu-Chan';
            return `${role}: ${msg.content}`;
        }).join('\n');
    }

    async loadMemory(conversationId = 'default') {
        try {
            const memoryContent = await fs.readFile(this.memoryFilePath, 'utf8');
            
            // Parse memory by conversation ID
            const sections = memoryContent.split('\n## ');
            const userSection = sections.find(section => 
                section.includes(`Conversation: ${conversationId}`) || 
                (conversationId === 'default' && section.includes('## Default User'))
            );
            
            if (userSection) {
                // Extract bullet points
                const lines = userSection.split('\n');
                const bulletPoints = lines.filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'));
                return bulletPoints.join('\n');
            }
            
            return '';
        } catch (error) {
            // File doesn't exist yet
            return '';
        }
    }

    async saveMemory(memoryContent, conversationId = 'default') {
        try {
            let existingContent = '';
            try {
                existingContent = await fs.readFile(this.memoryFilePath, 'utf8');
            } catch (error) {
                // File doesn't exist, will create new
            }

            // Update or create section for this conversation
            const sectionHeader = conversationId === 'default' ? 
                '## Default User Memory' : 
                `## User Memory - Conversation: ${conversationId}`;
            
            const timestamp = new Date().toISOString();
            const newSection = `${sectionHeader}
*Last updated: ${timestamp}*

${memoryContent}

---
`;

            // Replace existing section or append new one
            if (existingContent.includes(sectionHeader)) {
                const regex = new RegExp(`${sectionHeader}[\\s\\S]*?(?=\\n## |$)`);
                existingContent = existingContent.replace(regex, newSection.trim());
            } else {
                existingContent = existingContent ? existingContent + '\n\n' + newSection : newSection;
            }

            await fs.writeFile(this.memoryFilePath, existingContent, 'utf8');
            console.log(`✅ Memory updated for conversation: ${conversationId}`);
        } catch (error) {
            console.error('❌ Failed to save memory:', error);
            throw error;
        }
    }

    async getMemoryForPrompt(conversationId = 'default') {
        try {
            const memory = await this.loadMemory(conversationId);
            if (!memory) return '';

            return `\n\n<user_memory>
Previous information about this user:
${memory}
</user_memory>`;
        } catch (error) {
            console.error('❌ Failed to load memory for prompt:', error);
            return '';
        }
    }

    async clearMemory(conversationId = 'default') {
        try {
            const existingContent = await fs.readFile(this.memoryFilePath, 'utf8');
            const sectionHeader = conversationId === 'default' ? 
                '## Default User Memory' : 
                `## User Memory - Conversation: ${conversationId}`;
            
            const regex = new RegExp(`${sectionHeader}[\\s\\S]*?(?=\\n## |$)`);
            const updatedContent = existingContent.replace(regex, '').trim();
            
            await fs.writeFile(this.memoryFilePath, updatedContent, 'utf8');
            return { success: true, message: 'Memory cleared' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = MemoryService;