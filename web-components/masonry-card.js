"use strict";

/**
 * <app-masonry-card>
 *
 * News card for the masonry grid.
 * Attributes: date, category, title, image-src
 * Optional: hidden (if present, adds .hidden for "See More" reveal)
 *
 * CSS: styles/organisms/masonry-card.css
 */
class AppMasonryCard extends HTMLElement {
  static get observedAttributes() {
    return ["date", "category", "title", "image-src", "hidden"];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  render() {
    const date = this.getAttribute("date") || "";
    const category = this.getAttribute("category") || "";
    const title = this.getAttribute("title") || "";
    const imageSrc = this.getAttribute("image-src") || "";
    const isHidden = this.hasAttribute("hidden");

    const img = document.createElement("img");
    img.className = "news-image";
    img.src = imageSrc;
    img.alt = "";
    img.loading = "lazy";

    const dateEl = document.createElement("h3");
    dateEl.className = "news-date";
    dateEl.textContent = date;

    const catEl = document.createElement("p");
    catEl.className = "news-category";
    catEl.textContent = category;

    const titleEl = document.createElement("h4");
    titleEl.className = "news-title";
    titleEl.textContent = title;

    const content = document.createElement("div");
    content.className = "news-content";
    content.appendChild(dateEl);
    content.appendChild(catEl);
    content.appendChild(titleEl);

    this.innerHTML = "";
    this.className = `news-card${isHidden ? " hidden" : ""}`;
    this.appendChild(img);
    this.appendChild(content);
  }
}

customElements.define("app-masonry-card", AppMasonryCard);
