// Types Vite gives an application: imports of CSS and other files, import.meta.env.
/// <reference types="vite/client" />

// Kendo UI for jQuery declares its types as the global namespace `kendo`, not as a module.
// The example imports it as a module and uses only what the adapter needs, plus culture().
declare module '@progress/kendo-ui' {
  const kendo: import('phlox-js/adapters/kendo').KendoLike & { culture(name: string): void };
  export default kendo;
}
