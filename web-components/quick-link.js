"use strict";

/**
 * <app-quick-link>
 *
 * Attributes:
 *   - icon (string): Remix Icon class (e.g. ri-file-text-line)
 *   - href (string): Link URL
 *   - data-translate (string): Translation key for the label
 *
 * Renders a quick link card with icon and label.
 * CSS: styles/organisms/quick-link.css
 */
class AppQuickLink extends HTMLElement {
  static get observedAttributes() {
    return ["icon", "href", "data-translate"];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  render() {
    const icon = this.getAttribute("icon") || "ri-link";
    const href = this.getAttribute("href") || "#";
    const key = this.getAttribute("data-translate") || "";
    const text = this.textContent.trim() || "";
    this.textContent = "";
    this.innerHTML = `
      <a class="quick-link">
        <i></i>
        <span></span>
      </a>
    `;
    const a = this.querySelector("a");
    const i = this.querySelector("i");
    const span = this.querySelector("span");
    if (a) a.setAttribute("href", href);
    if (i) i.className = icon;
    if (span) {
      span.textContent = text;
      if (key) {
        span.setAttribute("data-translate", key);
        this.removeAttribute("data-translate");
      }
    }
  }
}

customElements.define("app-quick-link", AppQuickLink);
