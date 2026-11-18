import { Button, For, If, Presenter, RouteFrame, state } from '@phloxcz/phlox-js';
import type { Params, Route } from '@phloxcz/phlox-js';

const ALL = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Dokument ${i + 1}` }));
let documents = [...ALL];

class DocumentPresenter extends Presenter<{ id: number }> {
  public override startup() {
    // An unknown id: error(404) ends the action with BadRequestError, app.onError shows it
    if (!documents.some(item => item.id === this.props.id)) this.error(404);
  }

  public render() {
    return <p>Detail: <strong>Dokument {this.props.id}</strong> <a href={this.link('/documents')}>zavřít</a></p>;
  }
}

/** Query parameters, link('this') with a changed page, a redirect after deleting. */
export default class DocumentsPresenter extends Presenter {
  public readonly page = state(1);
  public readonly items = state(documents);

  public override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id:int>', presenter: DocumentPresenter, props: ({ id }) => ({ id: Number(id) }) },
    { name: 'list', pattern: '/documents' },
  ];

  // Runs whenever the route or its parameters change, also ?page
  public actionDefault({ page = '1' }: Params) {
    this.page.set(Number(page));
    this.items.set(documents.slice((this.page() - 1) * 4, this.page() * 4));
  }

  public actionList(params: Params) {
    this.actionDefault(params);
  }

  public handleDelete(id: number) {
    documents = documents.filter(item => item.id !== id);
    this.flashMessage(`Dokument ${id} smazán.`);
    this.redirect('this');   // the action runs again though the URL is the same
  }

  public render() {
    const pages = () => Math.max(1, Math.ceil(documents.length / 4));
    return (
      <div>
        <ul>
          <For each={this.items} key={item => item.id}>
            {item => (
              <li>
                <a href={this.link('detail', { id: item().id })}>{() => item().name}</a>{' '}
                <Button small onClick={() => this.handleDelete(item().id)}>Smazat</Button>
              </li>
            )}
          </For>
        </ul>
        <p>
          <If when={() => this.page() > 1}><a href={this.link('this', { page: this.page() - 1 })}>← předchozí</a> </If>
          strana {this.page} z {pages}
          <If when={() => this.page() < pages()}> <a href={this.link('this', { page: this.page() + 1 })}>další →</a></If>
        </p>
        <p><a href={this.link('detail', { id: 99 })}>Neexistující dokument (error 404)</a></p>
        <RouteFrame />
      </div>
    );
  }
}
