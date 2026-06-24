import { defineMiddleware } from 'astro:middleware';

const CANONICAL_HOST = 'everypinyoutake.com';

// Runs on every SSR response. Cloudflare Pages `_headers` only decorates static
// assets, so security headers + the www→apex redirect have to live here to cover
// the worker-rendered HTML pages.
export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Canonicalize www → apex (301) so search engines index one hostname.
  if (url.hostname === `www.${CANONICAL_HOST}`) {
    url.hostname = CANONICAL_HOST;
    return context.redirect(url.toString(), 301);
  }

  const response = await next();

  // Sensible security defaults for every HTML/page response.
  const h = response.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  return response;
});
