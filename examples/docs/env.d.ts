/// <reference types="vite/client" />

/** A page of the documentation, made by the plugin in markdown.ts. */
declare module '*.md' {
  import type { Demo } from './page';
  export const title: string;
  export const html: string;
  export const toc: { id: string; text: string }[];
  export const demos: Record<string, Demo>;
}
