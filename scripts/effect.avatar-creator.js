"use strict";

/**
 * Module: effect.avatar-creator.js
 * Type: Effect module
 * Purpose: Ready Player Me avatar creator iframe and message handling.
 *
 * Depends on: effect.error.js
 * Used by: avatar.html
 * Side effects: DOM, postMessage
 */

import { handleError } from "./effect.error.js";

const SUBDOMAIN = "demo";
const frame = document.getElementById("frame");
const urlEl = document.getElementById("avatarUrl");

if (frame) {
  frame.src = `https://${SUBDOMAIN}.readyplayer.me/avatar?frameApi`;
}

function parse(event) {
  try {
    return typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  } catch {
    return null;
  }
}

function subscribe(event) {
  const json = parse(event);
  if (json?.source !== "readyplayerme") return;

  if (json.eventName === "v1.frame.ready") {
    frame?.contentWindow?.postMessage(
      JSON.stringify({
        target: "readyplayerme",
        type: "subscribe",
        eventName: "v1.**",
      }),
      "*"
    );
  }

  if (json.eventName === "v1.avatar.exported") {
    if (urlEl) {
      urlEl.textContent = `Avatar URL: ${json.data?.url ?? ""}`;
      urlEl.classList.add("has-url");
    }
    if (frame) frame.hidden = true;
  }
}

function displayIframe() {
  if (frame) frame.hidden = false;
}

window.addEventListener("message", subscribe);
document.addEventListener("message", subscribe);

document.getElementById("createAvatarBtn")?.addEventListener("click", displayIframe);
