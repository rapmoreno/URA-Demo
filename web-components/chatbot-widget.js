"use strict";

import { CONFIG } from "../scripts/config.js";

/**
 * <app-chatbot-widget>
 *
 * Floating trigger button and modal with iframe.
 * Uses CONFIG.CHATBOT_IFRAME_URL for iframe src.
 * Self-contained: wires open/close internally.
 * CSS: styles/organisms/chatbot-widget.css
 */
class AppChatbotWidget extends HTMLElement {
  constructor() {
    super();
    /** @type {HTMLDivElement | null} */
    this._modal = null;
  }

  connectedCallback() {
    this.innerHTML = `
      <div class="chatbot-trigger" id="chatbotTrigger">
        <i class="ri-question-answer-line"></i>
      </div>
      <div class="chatbot-modal" id="chatbotModal">
        <div class="chatbot-modal-backdrop"></div>
        <div class="chatbot-modal-content">
          <button class="chatbot-close" id="chatbotClose">
            <i class="ri-close-line"></i>
          </button>
          <iframe 
            width="100%" 
            height="100%" 
            frameborder="0" 
            class="chatbot-iframe"
            title="URA AI Chatbot Assistant">
          </iframe>
        </div>
      </div>
    `;

    const trigger = this.querySelector("#chatbotTrigger");
    this._modal = this.querySelector("#chatbotModal");
    const closeBtn = this.querySelector("#chatbotClose");
    const backdrop = this._modal?.querySelector(".chatbot-modal-backdrop");
    const iframe = this.querySelector("iframe");

    if (iframe) {
      iframe.setAttribute("src", CONFIG.CHATBOT_IFRAME_URL);
    }

    const open = () => {
      if (this._modal) {
        this._modal.classList.add("show");
        document.body.style.overflow = "hidden";
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow?.postMessage({ action: "enableAudio" }, "*");
          };
        }
      }
    };

    const close = () => {
      if (this._modal) {
        this._modal.classList.remove("show");
        document.body.style.overflow = "";
      }
    };

    trigger?.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    this._modal?.addEventListener("click", (e) => {
      if (e.target === this._modal || e.target === backdrop) close();
    });
  }
}

customElements.define("app-chatbot-widget", AppChatbotWidget);
