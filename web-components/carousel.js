"use strict";

/**
 * <app-carousel>
 *
 * Renders carousel-container and carousel-track (id="carouselTrack").
 * Main.js populateCarousel populates the track; animation runs there.
 * CSS: styles/organisms/carousel.css (or inherited from ura-layout)
 */
class AppCarousel extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="carousel-container">
        <div class="carousel-track" id="carouselTrack"></div>
      </div>
    `;
  }
}

customElements.define("app-carousel", AppCarousel);
