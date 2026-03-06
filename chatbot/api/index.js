/**
 * Vercel Serverless Function Entry Point
 * Routes all requests through Express so static files (avatar, chat UI, js, css)
 * are served reliably. Fixes avatar and chat input not showing on Vercel.
 */
const app = require('../server');
module.exports = app;
