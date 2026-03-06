"use strict";

/**
 * <app-component-name>
 *
 * Attributes:
 *   - [attribute] ([type]): [description]
 *
 * Events dispatched:
 *   - app:[event-name] (detail: { [payload] })
 *
 * Expected children: [none | description]
 * CSS: styles/organisms/[component-name].css
 */
class ComponentName extends HTMLElement {
  static get observedAttributes() {
    return [];
  }

  connectedCallback() {
    this.innerHTML = `
      <!-- component markup -->
    `;
  }

  disconnectedCallback() {
    // Remove all window/document event listeners added in connectedCallback
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
  }
}

customElements.define('app-component-name', ComponentName);
