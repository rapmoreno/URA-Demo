"use strict";

/**
 * <app-section-header>
 *
 * Attributes:
 *   - data-translate (string): Translation key for the heading
 *
 * Renders section header with accent bar and h2.
 * CSS: styles/organisms/section-header.css
 */
class AppSectionHeader extends HTMLElement {
  connectedCallback() {
    const key = this.getAttribute("data-translate") || "";
    const text = this.textContent.trim() || "";
    this.textContent = "";
    this.innerHTML = `
      <div class="section-header">
        <div class="section-title-bar">
          <div class="title-accent"></div>
          <h2></h2>
        </div>
      </div>
    `;
    const h2 = this.querySelector("h2");
    if (h2) {
      h2.textContent = text;
      if (key) h2.setAttribute("data-translate", key);
    }
  }
}

customElements.define("app-section-header", AppSectionHeader);
