// Memory Management Tool Functions for Claude
const fs = require('fs').promises;
const path = require('path');

class MemoryTools {
    constructor() {
        this.memoryFilePath = path.join(__dirname, '..', 'prompt-persistent.md');
    }

    // Get tool definitions for Claude
    getToolDefinitions() {
        return [
            {
                name: "save_user_memory",
                description: "Save important information about the user for future conversations. Use this when the user shares personal details like name, interests, job, family, preferences, etc.",
                input_schema: {
                    type: "object",
                    properties: {
                        user_info: {
                            type: "string",
                            description: "Bullet points of user information to remember (e.g., '• Name: John Smith\n• Job: Software Engineer\n• Interests: Rock climbing, coffee\n• Has 4-year-old daughter')"
                        },
                        conversation_id: {
                            type: "string",
                            description: "Conversation ID to organize memory by user session",
                            default: "default"
                        }
                    },
                    required: ["user_info"]
                }
            },
            {
                name: "recall_user_memory",
                description: "Recall previously saved information about the user from past conversations",
                input_schema: {
                    type: "object",
                    properties: {
                        conversation_id: {
                            type: "string",
                            description: "Conversation ID to look up memory for",
                            default: "default"
                        }
                    },
                    required: []
                }
            },
            {
                name: "update_user_memory",
                description: "Update existing user memory with new information or corrections",
                input_schema: {
                    type: "object",
                    properties: {
                        user_info: {
                            type: "string",
                            description: "New or updated bullet points about the user"
                        },
                        conversation_id: {
                            type: "string",
                            description: "Conversation ID to update memory for",
                            default: "default"
                        }
                    },
                    required: ["user_info"]
                }
            }
        ];
    }

    // Execute tool calls
    async executeTool(toolName, parameters) {
        switch (toolName) {
            case 'save_user_memory':
                return await this.saveMemory(parameters.user_info, parameters.conversation_id || 'default');
            
            case 'recall_user_memory':
                return await this.recallMemory(parameters.conversation_id || 'default');
            
            case 'update_user_memory':
                return await this.updateMemory(parameters.user_info, parameters.conversation_id || 'default');
            
            default:
                return { success: false, error: `Unknown tool: ${toolName}` };
        }
    }

    async saveMemory(userInfo, conversationId = 'default') {
        try {
            const timestamp = new Date().toISOString();
            const sectionHeader = `## User Memory - ${conversationId}`;
            
            const newSection = `${sectionHeader}
*Last updated: ${timestamp}*

${userInfo}

---
`;

            let existingContent = '';
            try {
                existingContent = await fs.readFile(this.memoryFilePath, 'utf8');
            } catch (error) {
                // File doesn't exist, will create new
            }

            // Replace existing section or append new one
            if (existingContent.includes(sectionHeader)) {
                const regex = new RegExp(`${sectionHeader}[\\s\\S]*?(?=\\n## |$)`);
                existingContent = existingContent.replace(regex, newSection.trim());
            } else {
                existingContent = existingContent ? existingContent + '\n\n' + newSection : newSection;
            }

            await fs.writeFile(this.memoryFilePath, existingContent, 'utf8');
            
            return {
                success: true,
                message: `Memory saved for conversation ${conversationId}`,
                info_saved: userInfo.substring(0, 100) + '...'
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to save memory: ${error.message}`
            };
        }
    }

    async recallMemory(conversationId = 'default') {
        try {
            const memoryContent = await fs.readFile(this.memoryFilePath, 'utf8');
            
            const sectionHeader = `## User Memory - ${conversationId}`;
            const sections = memoryContent.split('\n## ');
            const userSection = sections.find(section => section.includes(`User Memory - ${conversationId}`));
            
            if (userSection) {
                // Extract bullet points
                const lines = userSection.split('\n');
                const bulletPoints = lines.filter(line => 
                    line.trim().startsWith('•') || 
                    line.trim().startsWith('-') ||
                    line.trim().startsWith('*')
                ).filter(line => 
                    // Remove formatting lines like timestamps and separators
                    !line.includes('Last updated:') && 
                    !line.includes('---') &&
                    line.trim().length > 1
                );
                
                if (bulletPoints.length > 0) {
                    // Convert format when recalling
                    const convertedMemory = bulletPoints.join('\n').replace(/• Name: ([^•\n]+)/g, '• <user_name>: $1');
                    
                    return {
                        success: true,
                        memory_found: true,
                        user_info: convertedMemory,
                        conversation_id: conversationId
                    };
                }
            }
            
            return {
                success: true,
                memory_found: false,
                message: `No memory found for conversation ${conversationId}`,
                conversation_id: conversationId
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to recall memory: ${error.message}`
            };
        }
    }

    async updateMemory(newUserInfo, conversationId = 'default') {
        try {
            // First recall existing memory
            const existingMemory = await this.recallMemory(conversationId);
            
            let combinedInfo = newUserInfo;
            if (existingMemory.memory_found) {
                // Parse existing bullet points
                const existingPoints = existingMemory.user_info
                    .split('\n')
                    .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'))
                    .join('\n');
                    
                combinedInfo = `${existingPoints}\n${newUserInfo}`;
            }
            
            // Save the combined information
            return await this.saveMemory(combinedInfo, conversationId);
        } catch (error) {
            return {
                success: false,
                error: `Failed to update memory: ${error.message}`
            };
        }
    }
}

module.exports = MemoryTools;