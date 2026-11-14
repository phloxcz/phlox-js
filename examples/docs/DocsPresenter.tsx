import { For, Presenter, RouteFrame, state } from 'phlox-js';
import type { Route } from 'phlox-js';
import { AppearanceSwitch } from '../shared/appearance';
import { CONTENTS } from './contents';
import { PagePresenter } from './PagePresenter';

/** The layout of the documentation: the menu of sections on the left, the page on the right. */
export class DocsPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'home', pattern: '/' },
    { name: 'page', pattern: '/<section>/<page>', presenter: PagePresenter, props: ({ section, page }) => ({ route: `/${section}/${page}` }) },
  ];

  /** The menu on a phone, opened by the button in the header. */
  readonly menuOpen = state(false);

  actionHome() {
    this.redirect('/start/introduction');
  }

  override pageTitle() {
    return null;
  }

  render() {
    const current = () => `/${this.params().section}/${this.params().page}`;
    return (
      <div class={() => `docs ${this.menuOpen() ? 'docs-menu-open' : ''}`}>
        <header class="docs-header">
          <button type="button" class="docs-menu-button" aria-expanded={() => String(this.menuOpen())} onClick={() => this.menuOpen.update(open => !open)}>
            Menu
          </button>
          <a href={this.link('/start/introduction')} class="docs-logo">PhloxJS</a>
          {/* Another application: target leaves the link to the browser, the router would look for a page */}
          <a href="/helpdesk" target="_self" class="docs-app-link"><span class="docs-wide">Ukázková aplikace: </span>Helpdesk</a>
          <div class="docs-wide"><AppearanceSwitch /></div>
        </header>
        <nav class="docs-menu" aria-label="Dokumentace" onClick={() => this.menuOpen.set(false)}>
          <For each={() => CONTENTS}>
            {section => (
              <section>
                <h2>{section.title}</h2>
                <ul>
                  <For each={() => section.pages}>
                    {page => {
                      const route = `/${section.path}/${page.path}`;
                      return (
                        <li>
                          <a href={this.link(route)} aria-current={() => (current() === route ? 'page' : null)}>{page.title}</a>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              </section>
            )}
          </For>
          {/* On a phone the switch of the look is here, the header has no room for it */}
          <div class="docs-narrow docs-menu-appearance"><AppearanceSwitch /></div>
        </nav>
        <main class="docs-main">
          <RouteFrame />
        </main>
      </div>
    );
  }
}
