"use strict";

/**
 * <app-site-nav>
 *
 * Wraps children in main-nav > nav-content structure.
 * Children: nav-section-1 (logo), nav-section-2 (toggles), nav-section-3 (menu + actions).
 * IDs (languageToggle, languageDropdown, etc.) preserved for main.js wiring.
 * CSS: styles/organisms/site-nav.css
 */
class AppSiteNav extends HTMLElement {
  connectedCallback() {
    const outer = document.createElement("div");
    outer.className = "main-nav";
    const inner = document.createElement("div");
    inner.className = "nav-content";
    while (this.firstChild) {
      inner.appendChild(this.firstChild);
    }
    outer.appendChild(inner);
    this.appendChild(outer);
  }
}

customElements.define("app-site-nav", AppSiteNav);
