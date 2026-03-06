"use strict";

/**
 * Module: main.js
 * Type: Entry point
 * Purpose: Initialize app, wire events, load content.
 *
 * Depends on: effect.translation, effect.state, pure.service-cards, pure.news
 * Used by: index.html
 * Side effects: DOM, events
 */

import {
  initTranslation,
  setLanguage,
  getCurrentLanguage,
  getTranslations,
} from "./effect.translation.js";
import { getState, updateState } from "./effect.state.js";
import { handleError } from "./effect.error.js";
import { SERVICE_CARD_CONFIG } from "./pure.service-cards.js";
import { NEWS_IMAGES } from "./pure.news.js";

// Web components - register before use
import "../web-components/section-header.js";
import "../web-components/quick-link.js";
import "../web-components/footer-column.js";
import "../web-components/site-nav.js";
import "../web-components/chatbot-widget.js";
import "../web-components/masonry-card.js";
import "../web-components/carousel.js";
import "../web-components/service-card.js";

/** @type {number | null} */
let carouselAnimationId = null;

function wireLanguageToggle() {
  const languageToggle = document.getElementById("languageToggle");
  const languageDropdown = document.getElementById("languageDropdown");
  const languageOptions = document.querySelectorAll(".language-option");

  if (!languageToggle || !languageDropdown) return;

  languageToggle.addEventListener("click", (e) => {
    e.preventDefault();
    languageDropdown.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (
      !languageToggle.contains(e.target) &&
      !languageDropdown.contains(e.target)
    ) {
      languageDropdown.classList.remove("show");
    }
  });

  languageOptions.forEach((opt) => {
    opt.addEventListener("click", async (e) => {
      e.preventDefault();
      const lang = opt.getAttribute("data-lang");
      languageOptions.forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      await setLanguage(lang);
      languageDropdown.classList.remove("show");
    });
  });

  const saved = getState().language;
  const active = document.querySelector(`[data-lang="${saved}"]`);
  if (active) active.classList.add("active");
}

function wireThemeToggle() {
  const themeToggle = document.querySelector(".theme-toggle");
  if (!themeToggle) return;
  const icon = themeToggle.querySelector("i");
  const saved = getState().theme;
  document.documentElement.setAttribute("data-theme", saved);
  if (icon) icon.className = saved === "dark" ? "ri-moon-line" : "ri-sun-line";

  themeToggle.addEventListener("click", () => {
    const cur = getState().theme;
    const next = cur === "light" ? "dark" : "light";
    updateState((s) => ({ ...s, theme: next }));
    document.documentElement.setAttribute("data-theme", next);
    if (icon) icon.className = next === "dark" ? "ri-moon-line" : "ri-sun-line";
  });
}

function initializeCarousel() {
  const translations = getTranslations();
  const lang = getCurrentLanguage();
  const data = translations[lang];
  if (!data?.ideasTrends?.articles) return;

  const track = document.getElementById("carouselTrack");
  if (!track) return;

  track.innerHTML = "";
  if (carouselAnimationId) {
    cancelAnimationFrame(carouselAnimationId);
  }

  const articles = data.ideasTrends.articles;
  const slideWidth = 312;
  const viewportWidth = window.innerWidth;
  const slidesInView = Math.ceil(viewportWidth / slideWidth) + 2;
  const totalSlides = Math.max(50, slidesInView * 3);

  for (let i = 0; i < totalSlides; i++) {
    const article = articles[i % articles.length];
    const slide = document.createElement("div");
    slide.className = "carousel-slide";
    slide.innerHTML = `
      <div class="article-card">
        <div class="article-image article-image-${(i % 6) + 1}"></div>
        <div class="article-content">
          <h3>${escapeHtml(article.title)}</h3>
          <p>${escapeHtml(article.description)}</p>
        </div>
      </div>
    `;
    track.appendChild(slide);
  }

  let currentTransform = 0;
  const speed = 0.3;
  let isPaused = false;
  const resetPoint = slideWidth * articles.length;

  function animate() {
    if (!isPaused) {
      currentTransform += speed;
      if (currentTransform >= resetPoint) currentTransform -= resetPoint;
      track.style.transform = `translateX(-${currentTransform}px)`;
    }
    carouselAnimationId = requestAnimationFrame(animate);
  }
  animate();

  const container = document.querySelector(".carousel-container");
  if (container) {
    container.addEventListener("mouseenter", () => (isPaused = true));
    container.addEventListener("mouseleave", () => (isPaused = false));
  }
}

function initializeNews() {
  const translations = getTranslations();
  const lang = getCurrentLanguage();
  const data = translations[lang];
  if (!data?.latestNews?.news) return;

  const grid = document.getElementById("newsMasonryGrid");
  if (!grid) return;

  grid.innerHTML = "";
  const news = data.latestNews.news;

  news.forEach((item, index) => {
    const card = document.createElement("app-masonry-card");
    card.setAttribute("date", item.date);
    card.setAttribute("category", item.category);
    card.setAttribute("title", item.title);
    card.setAttribute("image-src", NEWS_IMAGES[index % NEWS_IMAGES.length]);
    if (index >= 3) card.setAttribute("hidden", "");
    grid.appendChild(card);
  });

  updateSeeMoreButton();
}

function updateSeeMoreButton() {
  const btn = document.querySelector(".latest-news-section .see-more-btn");
  const hidden = document.querySelectorAll("app-masonry-card[hidden]");
  if (!btn) return;
  if (hidden.length > 0) {
    btn.style.display = "inline-block";
  } else {
    btn.style.display = "none";
  }
}

function wireSeeMoreNews() {
  const section = document.querySelector(".latest-news-section");
  if (!section) return;
  section.addEventListener("click", (e) => {
    if (e.target.closest(".see-more-btn")) showMoreNews();
  });
}

function showMoreNews() {
  const hidden = document.querySelectorAll("app-masonry-card[hidden]");
  hidden.forEach((card, i) => {
    setTimeout(() => {
      card.removeAttribute("hidden");
      card.classList.add("fade-in");
      setTimeout(() => card.classList.remove("fade-in"), 600);
    }, i * 100);
  });
  const btn = document.querySelector(".latest-news-section .see-more-btn");
  if (btn) {
    setTimeout(() => (btn.style.display = "none"), hidden.length * 100);
  }
}

function initializeServiceCards() {
  const translations = getTranslations();
  const lang = getCurrentLanguage();
  const serviceCards = translations[lang]?.serviceCards;
  if (!serviceCards) return;

  const grid = document.getElementById("servicesGrid");
  if (!grid) return;

  grid.innerHTML = "";
  for (const config of SERVICE_CARD_CONFIG) {
    const data = serviceCards[config.key];
    if (!data) continue;
    const el = document.createElement("app-service-card");
    el.setAttribute("title", data.title);
    el.setAttribute("description", data.description);
    el.setAttribute("button-text", data.button);
    el.setAttribute("image-url", config.image);
    grid.appendChild(el);
  }
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function init() {
  try {
    await initTranslation();
    wireLanguageToggle();
    wireThemeToggle();
    wireSeeMoreNews();
    initializeCarousel();
    initializeNews();
    initializeServiceCards();

    document.addEventListener("app:language-changed", () => {
      initializeCarousel();
      initializeNews();
      initializeServiceCards();
    });
  } catch (err) {
    handleError(err, { module: "main.js", phase: "init" });
  }
}

document.addEventListener("DOMContentLoaded", init);
