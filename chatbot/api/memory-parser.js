// Memory Parser - Extract memory commands from Claude responses
const MemoryTools = require('./memory-tools');

class MemoryParser {
    constructor() {
        this.memoryTools = new MemoryTools();
    }

    // Parse Claude's response for memory commands
    parseAndExecuteMemoryCommands(response, conversationId) {
        console.log('🔍 Parsing response for memory commands:', response.substring(0, 200) + '...');
        console.log('🔍 Full response:', response);
        const commands = [];
        
        // Look for [SAVE_MEMORY: content] markers
        const saveMatches = response.match(/\[SAVE_MEMORY:\s*(.*?)\]/g);
        if (saveMatches) {
            console.log('✅ Found SAVE_MEMORY markers:', saveMatches);
            for (const match of saveMatches) {
                const content = match.replace(/\[SAVE_MEMORY:\s*/, '').replace(/\]$/, '');
                commands.push({
                    type: 'save',
                    content: content,
                    conversationId
                });
            }
        } else {
            console.log('❌ No SAVE_MEMORY markers found');
        }

        // Look for [RECALL_MEMORY] markers
        const recallMatches = response.match(/\[RECALL_MEMORY\]/g);
        if (recallMatches) {
            console.log('✅ Found RECALL_MEMORY markers:', recallMatches);
            commands.push({
                type: 'recall',
                conversationId
            });
        }

        console.log('📝 Total memory commands found:', commands.length);
        return commands;
    }

    // Convert standard name format to user_name format
    convertToUserNameFormat(memoryContent) {
        return memoryContent.replace(/• Name: ([^•\n]+)/g, '• <user_name>: $1');
    }

    // Execute memory commands and return results
    async executeMemoryCommands(commands) {
        const results = [];
        
        for (const command of commands) {
            try {
                let result;
                
                if (command.type === 'save') {
                    // Convert to user_name format if needed
                    const convertedContent = this.convertToUserNameFormat(command.content);
                    console.log(`🔄 Converting memory format:`, command.content, '->', convertedContent);
                    
                    // Check if memory already exists, if so use update instead of save
                    const existingMemory = await this.memoryTools.executeTool('recall_user_memory', {
                        conversation_id: command.conversationId
                    });
                    
                    if (existingMemory.memory_found) {
                        result = await this.memoryTools.executeTool('update_user_memory', {
                            user_info: convertedContent,
                            conversation_id: command.conversationId
                        });
                    } else {
                        result = await this.memoryTools.executeTool('save_user_memory', {
                            user_info: convertedContent,
                            conversation_id: command.conversationId
                        });
                    }
                } else if (command.type === 'recall') {
                    result = await this.memoryTools.executeTool('recall_user_memory', {
                        conversation_id: command.conversationId
                    });
                }
                
                results.push({ command, result });
                console.log(`🧠 Executed ${command.type} memory command:`, result.success ? '✅' : '❌');
                
            } catch (error) {
                console.error('❌ Memory command failed:', error);
                results.push({ command, error: error.message });
            }
        }
        
        return results;
    }

    // Clean response by removing memory markers
    cleanResponse(response) {
        return response
            .replace(/\[SAVE_MEMORY:\s*.*?\]/g, '')
            .replace(/\[RECALL_MEMORY\]/g, '')
            .replace(/\s+/g, ' ') // Remove extra whitespace
            .trim();
    }

    // Process memory commands and return enhanced prompt
    async processMemoryAndEnhancePrompt(response, conversationId, originalPrompt) {
        // Parse and execute memory commands
        const memoryCommands = this.parseAndExecuteMemoryCommands(response, conversationId);
        
        if (memoryCommands.length > 0) {
            const results = await this.executeMemoryCommands(memoryCommands);
            
            // If there was a RECALL command, inject memory into the response context
            const recallResults = results.filter(r => r.command.type === 'recall');
            if (recallResults.length > 0) {
                for (const recall of recallResults) {
                    if (recall.result.memory_found) {
                        console.log('🧠 Injecting recalled memory into context');
                        // This would be used to enhance the AI's context in future iterations
                        return {
                            hasMemory: true,
                            memory: recall.result.user_info,
                            conversationId: recall.result.conversation_id
                        };
                    }
                }
            }
        }
        
        return { hasMemory: false };
    }
}

module.exports = MemoryParser;