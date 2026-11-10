import { For, Presenter, RouteFrame } from 'phlox-js';
import type { Route } from 'phlox-js';
import { locales, t, translator } from '../i18n';
import { ListPresenter } from './ListPresenter';

/** The layout: navigation, flash messages and the place for the presenter of the current route. */
export class AppPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'about', pattern: '/about', presenter: () => import('./AboutPresenter') },
    // An empty pattern takes nothing from the URL, the list handles all the rest
    { name: 'list', pattern: '', presenter: ListPresenter },
  ];

  /** The texts already shown stay in the old language, so the whole tree is built again. */
  handleLocale(locale: string): void {
    translator.setLocale(locale, locales[locale]!);
    document.documentElement.lang = locale;
    void this.app.restart();
  }

  render() {
    const flashes = this.app.flashes;
    return (
      <div>
        <nav>
          <a href={this.link('list')} class={() => (this.route() === 'list' ? 'active' : '')}>{t('nav.list')}</a>
          <a href={this.link('about')} class={() => (this.route() === 'about' ? 'active' : '')}>{t('nav.about')}</a>
          <span class="languages">
            <For each={() => Object.keys(locales)}>
              {locale => (
                <button disabled={locale === translator.locale} onClick={() => this.handleLocale(locale)}>
                  {locale.toUpperCase()}
                </button>
              )}
            </For>
          </span>
        </nav>

        <For each={flashes.messages}>
          {flash => <p class={`flash ${flash.type}`} onClick={() => flashes.remove(flash)}>{flash.text}</p>}
        </For>

        <RouteFrame />
      </div>
    );
  }
}
