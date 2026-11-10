import { defineConfig } from 'vitest/config';
import { phlox } from './src/vite.ts';

export default defineConfig({
  // The framework itself is built without the plugin, so its own classes are left as they are
  plugins: [phlox({ exclude: /\/phlox-js\/src\// })],
  // `phlox-js` and the JSX runtime resolve to src/ through `paths` in tsconfig.json
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
