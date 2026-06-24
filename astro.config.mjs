// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// SSR on Cloudflare so the collection is always fresh after admin edits,
// with static prerendering for content pages (see `export const prerender = true`).
export default defineConfig({
  // Canonical origin — powers <link rel="canonical">, Open Graph URLs, and the sitemap.
  site: 'https://everypinyoutake.com',
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [
    react(),
    // Generates /sitemap-index.xml + /sitemap-0.xml at build; keep the admin out of it.
    sitemap({
      filter: (page) => !page.includes('/admin'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      // Server-only secrets — never shipped to the browser.
      // ADMIN_PIN: the code you & your wife type (defaults to 6400 if unset).
      ADMIN_PIN: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Service key authorizes saves server-side so the public anon key can't write.
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
