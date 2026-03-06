"use strict";

/**
 * Module: agent_executor.js
 * Calls OpenRouter API with provider_routing. All agents use OpenRouter + Groq.
 * Agent used: from registry
 * Model used: from registry
 * Called from: chatbot/api/chatbot.js
 */

const fs = require("fs").promises;
const path = require("path");
const { loadRegistry, getAgent, PROJECT_ROOT } = require("./registry_loader.js");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * @param {string} agentId
 * @param {string} systemPrompt
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]
 * @returns {Promise<{success: boolean, response?: string, error?: string}>}
 */
async function executeAgent(agentId, systemPrompt, messages, options = {}) {
  await loadRegistry();
  const agent = getAgent(agentId);
  if (!agent || !agent.enabled) {
    return { success: false, error: `Agent ${agentId} not found or disabled` };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "OPENROUTER_API_KEY not configured",
    };
  }

  const provider = agent.provider_routing
    ? { order: agent.provider_routing.order || ["Groq"], allow_fallbacks: agent.provider_routing.allow_fallbacks ?? false }
    : { order: ["Groq"], allow_fallbacks: false };

  const body = {
    model: agent.model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    temperature: agent.params?.temperature ?? 0.8,
    max_tokens: agent.params?.max_tokens ?? 1000,
    provider,
  };

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error?.message || res.statusText || "OpenRouter request failed",
      };
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    return { success: true, response: content };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Load prompt from prompts/ directory.
 * @param {string} promptFile - e.g. prompts/ura_chatbot_faq.md
 * @returns {Promise<string>}
 */
async function loadPrompt(promptFile) {
  const fullPath = path.join(PROJECT_ROOT, promptFile);
  return fs.readFile(fullPath, "utf8");
}

module.exports = { executeAgent, loadPrompt };
