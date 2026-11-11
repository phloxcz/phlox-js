// All examples as one site: `npm run dev` serves examples/ with the front page at / and every example under its path.
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { phlox } from '../src/vite.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const examples = readdirSync(root).filter(name => name !== 'dist' && existsSync(`${root}/${name}/index.html`));

/** A URL inside an example, like /grid/1001, gets the page of that example; its router does the rest. */
function examplePages(): Plugin {
  return {
    name: 'example-pages',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const [path = '', search = ''] = (request.url ?? '').split('?');
        const name = path.split('/')[1] ?? '';
        const page = examples.includes(name) && !/\.\w+$/.test(path) && request.headers.accept?.includes('text/html');
        if (page) request.url = `/${name}/index.html${search ? `?${search}` : ''}`;
        next();
      });
    },
  };
}

export default defineConfig({
  root,
  plugins: [phlox({ exclude: /\/phlox-js\/src\// }), examplePages()],
  // `phlox-js` and the JSX runtime resolve to src/ through `paths` in tsconfig.json
  resolve: { tsconfigPaths: true },
  build: {
    rollupOptions: {
      input: { index: `${root}/index.html`, ...Object.fromEntries(examples.map(name => [name, `${root}/${name}/index.html`])) },
    },
  },
});
