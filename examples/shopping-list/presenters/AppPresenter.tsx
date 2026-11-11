import { For, Presenter, RouteFrame } from 'phlox-js';
import type { Route } from 'phlox-js';
import { locales, t, translateFramework, translator } from '../i18n';
import { ListPresenter } from './ListPresenter';

/** The layout: navigation and the place for the presenter of the current route. Flash messages are shown by capify, see services.ts. */
export class AppPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'about', pattern: '/about', presenter: () => import('./AboutPresenter') },
    // An empty pattern takes nothing from the URL, the list handles all the rest
    { name: 'list', pattern: '', presenter: ListPresenter },
  ];

  /** The texts already shown stay in the old language, so the whole tree is built again. */
  handleLocale(locale: string): void {
    translator.setLocale(locale, locales[locale]!);
    translateFramework();
    document.documentElement.lang = locale;
    void this.app.restart();
  }

  render() {
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

        <RouteFrame />
      </div>
    );
  }
}
