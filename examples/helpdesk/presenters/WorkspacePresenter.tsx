import { Presenter, RouteFrame } from 'phlox-js';
import type { Route } from 'phlox-js';
import { Icon, Logo } from '../components/Icon';
import { MainMenu, MenuLinks } from '../components/MainMenu';
import type { MenuEntry } from '../components/MainMenu';
import { Notifications } from '../components/Notifications';
import { SearchBox } from '../components/SearchBox';
import { SupportContact } from '../components/SupportContact';
import { UserMenu } from '../components/UserMenu';
import { Store } from '../model/Store';
import { ProjectsPresenter } from './ProjectsPresenter';
import { TasksPresenter } from './TasksPresenter';

/** The layout after sign-in: the header, the menu on the left and the screen of the current route. */
export class WorkspacePresenter extends Presenter {
  override routes: Route[] = [
    { name: 'projects', pattern: '/projects', presenter: ProjectsPresenter },
    // The same presenter as in a project, with other props
    { name: 'my', pattern: '/my', presenter: TasksPresenter, props: () => ({ mine: true }) },
    { name: 'all', pattern: '/all', presenter: TasksPresenter, props: () => ({}) },
    { name: 'reports', pattern: '/reports', presenter: () => import('./ReportsPresenter') },
    { name: 'settings', pattern: '/settings', presenter: () => import('./SettingsPresenter') },
    { name: 'home', pattern: '/' },
  ];

  /** The menu on the left shows icons only; the user's choice is remembered in the browser. */
  readonly collapsed = this.preference('helpdesk.nav.collapsed', false);

  constructor(private store: Store) {
    super();
  }

  private entries(): MenuEntry[] {
    const entry = (route: string, icon: MenuEntry['icon'], text: string, count?: () => number): MenuEntry =>
      ({ href: this.link(route), icon, text, current: () => this.route() === route, ...(count ? { count } : {}) });
    return [
      entry('projects', 'folder', 'Projekty'),
      entry('my', 'squareCheck', 'Moje úkoly', this.store.mine),
      entry('all', 'clipboard', 'Všechny úkoly'),
      entry('reports', 'chart', 'Reporty'),
      entry('settings', 'settings', 'Nastavení'),
    ];
  }

  /** On a phone the menu is a panel sliding in from the left. */
  handleMenu(): void {
    void this.openDialog(MainMenu, { entries: this.entries() }, { placement: 'start', class: 'hd-menu-dialog' });
  }

  override async startup() {
    if (!this.user.isLoggedIn()) return this.redirect('/sign');
    await this.store.load();
  }

  actionHome() {
    return this.redirect('projects');
  }

  async handleSupport(): Promise<void> {
    if (await this.openDialog(SupportContact, {})) this.flashMessage('Zpráva odešla, podpora se vám ozve.', 'success');
  }

  render() {
    return (
      <div class={() => `hd-shell ${this.collapsed() ? 'hd-nav-collapsed' : ''}`}>
        <header class="hd-header">
          <button type="button" class="hd-icon-button hd-hamburger" aria-label="Menu" onClick={() => this.handleMenu()}>
            <Icon name="menu" size={22} />
          </button>
          <a href={this.link('projects')} class="hd-brand"><Logo /> <span>HelpDesk Pro</span></a>
          <SearchBox />
          <div class="hd-header-tools">
            <Notifications />
            <UserMenu />
          </div>
        </header>
        <nav class="hd-nav" aria-label="Hlavní menu">
          <MenuLinks entries={this.entries()} />
          {/* A round button on the edge between the menu and the workspace */}
          <button type="button" class="hd-nav-toggle" aria-pressed={() => String(this.collapsed())}
            title={() => (this.collapsed() ? 'Rozbalit menu' : 'Sbalit menu')} aria-label={() => (this.collapsed() ? 'Rozbalit menu' : 'Sbalit menu')}
            onClick={() => this.collapsed.update(value => !value)}>
            {() => <Icon name={this.collapsed() ? 'chevronRight' : 'chevronLeft'} size={15} />}
          </button>
          <div class="hd-help">
            <span class="hd-help-icon"><Icon name="headset" size={30} /></span>
            <strong>Potřebujete pomoc?</strong>
            <button type="button" class="hd-link" onClick={() => this.handleSupport()}>
              Kontaktujte podporu <Icon name="arrowRight" size={14} />
            </button>
          </div>
        </nav>
        <main class="hd-workspace">
          <RouteFrame />
        </main>
      </div>
    );
  }
}
