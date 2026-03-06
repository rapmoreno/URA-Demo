"use strict";

/**
 * <app-service-card>
 *
 * Attributes:
 *   - title (string): Card title
 *   - description (string): Card description
 *   - button-text (string): Button label
 *   - image-url (string): Background image URL
 *
 * Events dispatched:
 *   - app:service-card-click (detail: { title, description, buttonText })
 *
 * CSS: styles/organisms/service-card.css
 */

class AppServiceCard extends HTMLElement {
  static get observedAttributes() {
    return ["title", "description", "button-text", "image-url"];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  disconnectedCallback() {
    if (this._onBtnClick) {
      const btn = this.querySelector(".btn");
      if (btn) btn.removeEventListener("click", this._onBtnClick);
    }
  }

  render() {
    const title = this.getAttribute("title") || "";
    const description = this.getAttribute("description") || "";
    const buttonText = this.getAttribute("button-text") || "Learn More";
    const imageUrl = this.getAttribute("image-url") || "";

    this.style.setProperty(
      "--service-card-bg",
      imageUrl ? `url('${imageUrl}')` : "none"
    );

    this.innerHTML = `
      <div class="card">
        <div class="content">
          <h3 class="title"></h3>
          <p class="description"></p>
          <button class="btn" type="button"></button>
        </div>
      </div>
    `;

    const titleEl = this.querySelector(".title");
    const descEl = this.querySelector(".description");
    const btnEl = this.querySelector(".btn");

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;
    if (btnEl) {
      btnEl.textContent = buttonText;
      this._onBtnClick = () => {
        this.dispatchEvent(
          new CustomEvent("app:service-card-click", {
            detail: { title, description, buttonText },
            bubbles: true,
          })
        );
      };
      btnEl.addEventListener("click", this._onBtnClick);
    }
  }
}

customElements.define("app-service-card", AppServiceCard);
