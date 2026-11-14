// The build of the package: every entry of package.json "exports" to dist/, module by module, as ES modules.
// Types come from tsc (tsconfig.build.json), CSS files are copied as they are. `npm run build` does all three.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const src = fileURLToPath(new URL('./src/', import.meta.url));
const dist = fileURLToPath(new URL('./dist/', import.meta.url));

/** Entries of the package, the same as "exports" in package.json. */
const ENTRIES = [
  'index', 'jsx-runtime', 'jsx-dev-runtime', 'vite',
  'forms/index', 'components/index', 'net/index', 'security/index', 'localization/index', 'testing/index',
  'locales/cs', 'adapters/kendo/index', 'adapters/capify/index',
  'net/rpc-types',
];
const CSS = ['styles/base.css', 'styles/default.css', 'adapters/kendo/kendo.css'];

function copyCss(): Plugin {
  return {
    name: 'phlox-copy-css',
    closeBundle() {
      for (const file of CSS) {
        mkdirSync(dirname(dist + file), { recursive: true });
        copyFileSync(src + file, dist + file);
      }
    },
  };
}

export default defineConfig({
  plugins: [copyCss()],
  // The JSX of the framework imports its own runtime, inside the package it is a module like the others
  resolve: { alias: [{ find: /^phlox-js\/(jsx-runtime|jsx-dev-runtime)$/, replacement: `${src}$1.ts` }] },
  oxc: { jsx: { runtime: 'automatic', importSource: 'phlox-js', development: false } },
  build: {
    outDir: dist,
    emptyOutDir: true,
    minify: false,
    target: 'es2022',
    lib: { entry: Object.fromEntries(ENTRIES.map(name => [name, `${src}${name}.ts`])), formats: ['es'] },
    rolldownOptions: {
      // The editor is a dependency, vite a peer of the plugin, node: only in the plugin and the generator of types
      external: [/^@phloxcz\/forms-editor/, /^vite$/, /^node:/],
      output: { preserveModules: true, preserveModulesRoot: src, entryFileNames: '[name].js' },
    },
  },
});
