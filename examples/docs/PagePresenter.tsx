import { For, If, Presenter, state } from '@phloxcz/phlox-js';
import { PAGES } from './contents';
import { DemoBox } from './page';
import type { Demo } from './page';

interface PageModule {
  title: string;
  html: string;
  toc: { id: string; text: string }[];
  demos: Record<string, Demo>;
}

/** Every page, loaded when it is opened. */
const PAGE_FILES = import.meta.glob<PageModule>('./*/*.md');

type Part = { html: string } | { demo: string };

/** The text split at its demos: <div data-demo="name"></div> made by the markdown plugin. */
function parts(html: string): Part[] {
  return html.split(/<div data-demo="([\w-]+)"><\/div>/).map((text, index) => (index % 2 ? { demo: text } : { html: text }));
}

/** One page of the documentation at /<section>/<page>. */
export class PagePresenter extends Presenter<{ route: string }> {
  readonly page = state<PageModule | null>(null);
  readonly missing = state(false);

  override async startup() {
    const load = PAGE_FILES[`.${this.props.route}.md`];
    if (!load) {
      this.missing.set(true);
      return;
    }
    this.page.set(await load());
  }

  // A new page starts at its top (the router does not restore scrolling yet), a link with #part goes to it
  override afterRender() {
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }

  override pageTitle() {
    return this.page()?.title ?? (this.missing() ? 'Stránka neexistuje' : null);
  }

  render() {
    const index = PAGES.findIndex(page => page.route === this.props.route);
    const previous = PAGES[index - 1];
    const next = PAGES[index + 1];
    return (
      <article class="docs-page">
        <If when={this.page}>
          {page => <>
            <For each={() => parts(page().html)}>
              {part => ('demo' in part
                ? <DemoBox name={part.demo} demo={page().demos[part.demo]!} />
                : <div class="docs-text" ref={element => { element.innerHTML = part.html; }} />)}
            </For>
            <nav class="docs-pager" aria-label="Další stránky">
              {previous ? <a href={this.link(previous.route)} rel="prev">← {previous.title}</a> : <span />}
              {next ? <a href={this.link(next.route)} rel="next">{next.title} →</a> : <span />}
            </nav>
          </>}
        </If>
        <If when={this.missing}>
          <h1>Stránka neexistuje</h1>
          <p>Vyberte stránku v menu.</p>
        </If>
      </article>
    );
  }
}
