/**
 * Tailwind config for Play CDN (browser).
 * Mirrors root tailwind.config.js. Used by index.html.
 */
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: {
          light: "var(--primary-light)",
          DEFAULT: "var(--primary-base)",
          dark: "var(--primary-dark)",
        },
        secondary: {
          light: "var(--secondary-light)",
          DEFAULT: "var(--secondary-base)",
          dark: "var(--secondary-dark)",
        },
        error: {
          light: "var(--error-light)",
          DEFAULT: "var(--error-base)",
          dark: "var(--error-dark)",
        },
        success: {
          light: "var(--success-light)",
          DEFAULT: "var(--success-base)",
          dark: "var(--success-dark)",
        },
        warning: {
          light: "var(--warning-light)",
          DEFAULT: "var(--warning-base)",
          dark: "var(--warning-dark)",
        },
        info: {
          light: "var(--info-light)",
          DEFAULT: "var(--info-base)",
          dark: "var(--info-dark)",
        },
        border: "var(--border)",
        surface: "var(--bg-surface)",
        page: "var(--bg-page)",
      },
    },
  },
};
