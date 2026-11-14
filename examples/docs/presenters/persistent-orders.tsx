import { For, Presenter, RouteFrame } from '@phloxcz/phlox-js';
import type { Route } from '@phloxcz/phlox-js';

class OrderPresenter extends Presenter<{ id: number }> {
  render() {
    return <p>Objednávka {this.props.id}. <a href={this.link('/')}>Zpět na seznam</a> (absolutní cesta nenese nic)</p>;
  }
}

/** page and sort are persistent: links of the presenter carry them on, tab is not. */
export default class OrdersPresenter extends Presenter {
  override persistent = ['page', 'sort'];

  override routes: Route[] = [
    { name: 'default', pattern: '/' },
    { name: 'detail', pattern: '/<id:int>', presenter: OrderPresenter, props: ({ id }) => ({ id: Number(id) }) },
  ];

  render() {
    return (
      <div>
        <p>
          <a href={this.link('this', { page: 3, sort: '-price', tab: 'x' })}>Nastavit ?page=3&sort=-price&tab=x</a>
        </p>
        <ul>
          <For each={() => [101, 102]}>
            {id => <li><a href={this.link('detail', { id })}>Objednávka {id}</a> (link nese page a sort)</li>}
          </For>
          <li><a href={this.link('detail', { id: 103, page: null })}>Objednávka 103 bez page</a> (null parametr vynechá)</li>
        </ul>
        <RouteFrame />
      </div>
    );
  }
}
