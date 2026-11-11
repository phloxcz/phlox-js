import { For, Presenter, RouteFrame } from 'phlox-js';
import type { Route } from 'phlox-js';
import { locales, t, translateFramework, translator } from '../i18n';
import { AppearanceSwitch } from '../../shared/appearance';
import { ListPresenter } from './ListPresenter';

/** The layout: navigation and the place for the presenter of the current route. Flash messages are toasts of the framework. */
export class AppPresenter extends Presenter {
  override routes: Route[] = [
    { name: 'recipe', pattern: '/recipe', presenter: () => import('./RecipePresenter') },
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
          <a href={this.link('recipe')} class={() => (this.route() === 'recipe' ? 'active' : '')}>{t('nav.recipe')}</a>
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

        <footer>
          <AppearanceSwitch texts={{
            theme: t('appearance.theme'), default: t('appearance.default'), bootstrap: 'Bootstrap',
            scheme: t('appearance.scheme'), system: t('appearance.system'), light: t('appearance.light'), dark: t('appearance.dark'),
            motion: t('appearance.motion'), on: t('appearance.on'), off: t('appearance.off'),
          }} />
        </footer>
      </div>
    );
  }
}
