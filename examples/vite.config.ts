// All examples as one site: `npm run dev` serves examples/ with the front page at / and every example under its path.
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { phlox } from '../src/vite.ts';
import { VitePWA } from 'vite-plugin-pwa';
import { helpdeskServer } from './helpdesk/server/plugin.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const examples = readdirSync(root).filter(name => name !== 'dist' && existsSync(`${root}/${name}/index.html`));

/** A URL inside an example, like /grid/1001, gets the page of that example; its router does the rest. */
function examplePages(): Plugin {
  const rewrite = (request: IncomingMessage, _response: ServerResponse, next: () => void) => {
    const [path = '', search = ''] = (request.url ?? '').split('?');
    const name = path.split('/')[1] ?? '';
    const page = examples.includes(name) && !/\.\w+$/.test(path) && request.headers.accept?.includes('text/html');
    if (page) request.url = `/${name}/index.html${search ? `?${search}` : ''}`;
    next();
  };
  return {
    name: 'example-pages',
    configureServer: server => void server.middlewares.use(rewrite),
    configurePreviewServer: server => void server.middlewares.use(rewrite),
  };
}

export default defineConfig({
  root,
  // The mock backend of the helpdesk goes first, its URLs must not become pages
  plugins: [
    phlox({ exclude: /\/phlox-js\/src\// }), helpdeskServer(), examplePages(),
    // The helpdesk as an installable PWA: its pages and assets are kept by a service worker and open offline.
    // Only in the build (npm run build:examples, then vite preview), the dev server serves modules one by one.
    VitePWA({
      injectRegister: false,
      registerType: 'prompt',
      scope: '/helpdesk/',
      manifest: {
        name: 'HelpDesk Pro', short_name: 'HelpDesk', lang: 'cs',
        start_url: '/helpdesk/', scope: '/helpdesk/', display: 'standalone',
        theme_color: '#008595', background_color: '#f5fafd',
        icons: [
          { src: '/helpdesk-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/helpdesk-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/helpdesk-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The site has other examples too; Kendo UI (10 MB) belongs to the Kendo example, not to the helpdesk
        globIgnores: ['**/kendo*.js', '**/node_modules/**'],
        // Any address of the helpdesk opens its page offline; the API and files are not pages
        navigateFallback: '/helpdesk/index.html',
        navigateFallbackAllowlist: [/^\/helpdesk(\/|$)/],
        navigateFallbackDenylist: [/^\/helpdesk\/(rpc|files)/],
      },
    }),
  ],
  // `phlox-js` and the JSX runtime resolve to src/ through `paths` in tsconfig.json
  resolve: { tsconfigPaths: true },
  build: {
    rollupOptions: {
      input: { index: `${root}/index.html`, ...Object.fromEntries(examples.map(name => [name, `${root}/${name}/index.html`])) },
    },
  },
});
