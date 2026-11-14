/**
 * A demo on a page of the documentation: the live demo and a tab with its code. A component is shown right
 * in the page; a presenter (routes, links, dialogs with a URL) runs in a frame with its own address bar.
 */

import { Component, If, Presenter, h, state } from '@phloxcz/phlox-js';
import type { Class, Container } from '@phloxcz/phlox-js';

/** A module of a demo: its default export, and services it needs. */
export interface DemoModule {
  default: Class<unknown> | ((props: object) => unknown);
  /** Services of the demo, added to the services of the application before it is shown. */
  services?: (container: Container) => void;
}

/** A demo as the markdown plugin describes it. */
export interface Demo {
  load: () => Promise<DemoModule>;
  /** Its code, highlighted. */
  source: string;
  /** Its file under examples/docs/. */
  file: string;
}

/** Is the default export a presenter? It runs in a frame then, with routes of its own. */
export function isPresenter(view: unknown): view is Class<Presenter> {
  return typeof view === 'function' && Presenter.prototype.isPrototypeOf((view as { prototype: object }).prototype);
}

const registered = new WeakSet<DemoModule>();

/** The frame grows with the demo inside it (the same origin, so it can be measured); CSS keeps room for dialogs. */
function fitToContent(frame: HTMLIFrameElement): void {
  frame.addEventListener('load', () => {
    const page = frame.contentDocument?.documentElement;
    if (!page) return;
    const fit = () => { frame.style.height = `${page.scrollHeight}px`; };
    new ResizeObserver(fit).observe(page);
    fit();
  });
}

export class DemoBox extends Component<{ name: string; demo: Demo }> {
  readonly tab = state<'demo' | 'code'>('demo');
  readonly view = state<DemoModule['default'] | null>(null);
  readonly framed = state(false);

  override async startup() {
    const module = await this.props.demo.load();
    if (isPresenter(module.default)) {
      this.framed.set(true);
      return;
    }
    if (!registered.has(module)) {
      registered.add(module);
      module.services?.(this.app.container);
    }
    this.view.set(module.default);
  }

  render() {
    const { demo } = this.props;
    const frame = `/frame/${demo.file.replace(/\.tsx$/, '')}/`;
    const tab = (name: 'demo' | 'code', text: string) => (
      <button type="button" role="tab" aria-selected={() => String(this.tab() === name)} onClick={() => this.tab.set(name)}>{text}</button>
    );
    return (
      <figure class="docs-demo">
        <div class="docs-demo-tabs" role="tablist">
          {tab('demo', 'Ukázka')}
          {tab('code', 'Kód')}
          <span class="docs-demo-file">{demo.file}</span>
        </div>
        <div class="docs-demo-view" hidden={() => this.tab() !== 'demo'}>
          <If when={this.framed}>
            <iframe class="docs-demo-frame" src={frame} title={`Ukázka ${this.props.name}`} loading="lazy" ref={fitToContent} />
          </If>
          {() => {
            const View = this.view();
            return View ? h(View as never, {}) : null;
          }}
        </div>
        <div class="docs-demo-code" hidden={() => this.tab() !== 'code'} ref={element => { element.innerHTML = demo.source; }} />
      </figure>
    );
  }
}
