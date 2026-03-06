"use strict";

/**
 * Module: registry_loader.js
 * Load and validate agents/registry.yaml
 * Agent used: N/A (loads config only)
 * Called from: chatbot/api/chatbot.js, agent_executor
 */

const fs = require("fs").promises;
const path = require("path");
const yaml = require("yaml");

const PROJECT_ROOT = path.join(__dirname, "..");
const REGISTRY_PATH = path.join(PROJECT_ROOT, "agents", "registry.yaml");

let cachedRegistry = null;

async function loadRegistry() {
  if (cachedRegistry) return cachedRegistry;
  const raw = await fs.readFile(REGISTRY_PATH, "utf8");
  cachedRegistry = yaml.parse(raw);
  return cachedRegistry;
}

function getAgent(agentId) {
  if (!cachedRegistry?.agents) return null;
  return cachedRegistry.agents.find((a) => a.id === agentId) ?? null;
}

module.exports = { loadRegistry, getAgent, PROJECT_ROOT };
