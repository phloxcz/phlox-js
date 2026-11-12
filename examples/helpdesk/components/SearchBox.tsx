import { Component, Else, For, If, computed, state, untrack } from 'phlox-js';
import type { Resource } from 'phlox-js';
import { HelpdeskApi } from '../api';
import type { SearchResult } from '../api';
import { Icon } from './Icon';

interface Hit {
  url: string;
  title: string;
  detail: string;
  kind: 'project' | 'task';
}

/** Search in projects and tasks in the header. Ctrl+K anywhere jumps into it, arrows choose a result. */
export class SearchBox extends Component {
  readonly text = state('');
  readonly active = state(0);
  readonly results: Resource<SearchResult | null>;
  readonly hits = computed<Hit[]>(() => {
    const found = this.results();
    if (!found || !this.text().trim()) return [];
    return [
      ...found.projects.map(project => ({ url: this.link(`/projects/${project.id}`), title: project.name, detail: project.subtitle, kind: 'project' as const })),
      ...found.tasks.map(task => ({ url: this.link(`/projects/${task.projectId}/${task.id}`), title: task.title, detail: task.projectName, kind: 'task' as const })),
    ];
  });
  private input!: HTMLInputElement;

  constructor(private api: HelpdeskApi) {
    super();
    // Again with every change of the text; an older answer never overwrites a newer one
    this.results = this.resource(async () => {
      const text = this.text().trim();
      return text ? this.api.call('search.query', { text }) : null;
    });
  }

  override afterRender() {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.input.focus();
        this.input.select();
      }
    };
    window.addEventListener('keydown', shortcut);
    this.scope.onCleanup(() => window.removeEventListener('keydown', shortcut));
  }

  private go(hit: Hit | undefined): void {
    if (!hit) return;
    this.text.set('');
    this.input.blur();
    void this.app.router.navigate(hit.url);
  }

  private keydown(event: KeyboardEvent): void {
    const count = untrack(this.hits).length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (count) this.active.update(index => (index + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.go(untrack(this.hits)[untrack(this.active)]);
    } else if (event.key === 'Escape') {
      this.text.set('');
    }
  }

  render() {
    return (
      <div class="hd-search" role="search">
        <Icon name="search" size={19} />
        <input
          type="search"
          class="form-control"
          placeholder="Hledat v projektech, úkolech…  (Ctrl + K)"
          aria-label="Hledat v projektech a úkolech"
          value={this.text}
          ref={input => { this.input = input; }}
          onInput={event => {
            this.text.set(event.currentTarget.value);
            this.active.set(0);
          }}
          onKeydown={event => this.keydown(event)}
          onBlur={() => setTimeout(() => this.text.set(''), 150)}
        />
        <If when={() => this.text().trim() !== ''}>
          <div class="hd-search-results">
            <If when={() => this.hits().length > 0}>
              <For each={this.hits}>
                {(hit, index) => (
                  <a href={hit.url} class="hd-search-hit" aria-current={() => (index() === this.active() ? 'true' : null)}
                    onMousedown={event => event.preventDefault()} onClick={() => this.text.set('')}>
                    <Icon name={hit.kind === 'project' ? 'folder' : 'squareCheck'} size={16} />
                    <span><strong>{hit.title}</strong><small>{hit.detail}</small></span>
                  </a>
                )}
              </For>
            <Else />
              <p class="hd-search-empty">{() => (this.results.loading() ? 'Hledám…' : 'Nic nenalezeno')}</p>
            </If>
          </div>
        </If>
      </div>
    );
  }
}

