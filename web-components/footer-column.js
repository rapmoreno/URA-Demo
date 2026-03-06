"use strict";

/**
 * <app-footer-column>
 *
 * Wraps children in a div.footer-column for footer grid layout.
 * Children may be: h3 + ul (links column) or .footer-promo (promo block).
 * CSS: styles/organisms/footer-column.css (via ura-layout)
 */
class AppFooterColumn extends HTMLElement {
  connectedCallback() {
    const wrapper = document.createElement("div");
    wrapper.className = "footer-column";
    while (this.firstChild) {
      wrapper.appendChild(this.firstChild);
    }
    this.appendChild(wrapper);
  }
}

customElements.define("app-footer-column", AppFooterColumn);
