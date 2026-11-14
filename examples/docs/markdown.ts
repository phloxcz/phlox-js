/**
 * Pages of the documentation are markdown next to their demos. This Vite plugin turns a page into a module
 * when it is built, so the site needs no markdown library:
 *
 *   export const title = 'DropDownList';
 *   export const html = '<p>…</p><div data-demo="dropdownlist-basic"></div>…';
 *   export const demos = { 'dropdownlist-basic': { load: () => import('./dropdownlist-basic.tsx'), source: '<pre…>', file: '…' } };
 *
 * `<!-- demo: name -->` in the text is a live demo from name.tsx next to the page, the tab with its code is
 * that same file, highlighted here. Links to other pages (`[Prvky](controls.md)`) become routes of the site.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { Marked } from 'marked';
import type { Tokens } from 'marked';
import { createHighlighter } from 'shiki';
import type { Plugin } from 'vite';

const LANGUAGES = ['tsx', 'ts', 'js', 'css', 'html', 'json', 'sh', 'php'];
const ALIASES: Record<string, string> = { typescript: 'ts', javascript: 'js', bash: 'sh', shell: 'sh' };
const DEMO = /<!--\s*demo:\s*([\w-]+)\s*-->/g;

type Highlighter = Awaited<ReturnType<typeof createHighlighter>>;
let highlighter: Promise<Highlighter> | null = null;

/** Code in both colours: CSS of the site chooses the light or the dark one. */
function highlight(shiki: Highlighter, code: string, language = ''): string {
  const lang = ALIASES[language] ?? language;
  return shiki.codeToHtml(code.replace(/\n$/, ''), {
    lang: LANGUAGES.includes(lang) ? lang : 'text',
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
}

const slug = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/<[^>]+>|`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The route of a page: docs/forms/controls.md → /forms/controls. */
export function routeOf(file: string, docs: string): string {
  return `/${relative(docs, file).split(sep).join('/').replace(/\.md$/, '')}`;
}

export function docsMarkdown(docs: string): Plugin {
  return {
    name: 'docs-markdown',
    async transform(text, id) {
      const file = resolve(id.split('?')[0]!);
      if (!file.endsWith('.md') || !file.startsWith(docs)) return null;
      highlighter ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: LANGUAGES });
      const shiki = await highlighter;
      const folder = dirname(file);

      const names: string[] = [];
      const body = text.replace(DEMO, (_, name: string) => {
        names.push(name);
        return `\n<div data-demo="${name}"></div>\n`;
      });

      let title = '';
      const toc: { id: string; text: string }[] = [];
      const marked = new Marked({
        renderer: {
          heading({ tokens, depth }: Tokens.Heading) {
            const inner = this.parser.parseInline(tokens);
            if (depth === 1) {
              title = inner.replace(/<[^>]+>/g, '');
              return `<h1>${inner}</h1>\n`;
            }
            const id = slug(inner);
            if (depth === 2) toc.push({ id, text: inner.replace(/<[^>]+>/g, '') });
            return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
          },
          code({ text: code, lang }: Tokens.Code) {
            return highlight(shiki, code, lang);
          },
          link({ href, tokens }: Tokens.Link) {
            const inner = this.parser.parseInline(tokens);
            const page = /^([^:#?]+\.md)(#.*)?$/.exec(href);
            if (page) return `<a href="${routeOf(resolve(folder, page[1]!), docs)}${page[2] ?? ''}">${inner}</a>`;
            const external = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
            // Another application on this site (/helpdesk): with target the router of the documentation leaves it to the browser
            const elsewhere = href.startsWith('/') && !existsSync(resolve(docs, `.${href.split(/[?#]/)[0]}.md`)) ? ' target="_self"' : '';
            return `<a href="${href}"${external}${elsewhere}>${inner}</a>`;
          },
        },
      });
      const html = await marked.parse(body);

      const demos = names.map(name => {
        const source = resolve(folder, `${name}.tsx`);
        if (!existsSync(source)) this.error(`${relative(docs, file)}: the demo ${name}.tsx does not exist`);
        this.addWatchFile(source);
        const code = readFileSync(source, 'utf8');
        return `${JSON.stringify(name)}: { load: () => import(${JSON.stringify(`./${name}.tsx`)}), `
          + `source: ${JSON.stringify(highlight(shiki, code, 'tsx'))}, file: ${JSON.stringify(relative(docs, source).split(sep).join('/'))} }`;
      });

      return {
        code: `export const title = ${JSON.stringify(title)};\n`
          + `export const html = ${JSON.stringify(html)};\n`
          + `export const toc = ${JSON.stringify(toc)};\n`
          + `export const demos = {\n  ${demos.join(',\n  ')}\n};\n`,
        map: null,
      };
    },
  };
}
