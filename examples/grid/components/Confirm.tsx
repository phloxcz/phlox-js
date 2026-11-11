import { Component } from 'phlox-js';

/** A yes/no question for actions of the grid, see Grid.confirm in OrdersPresenter. */
export class Confirm extends Component<{ question: string }, boolean> {
  override title() {
    return 'Potvrzení';
  }

  override actions() {
    return (
      <>
        <button type="button" onClick={() => this.close(false)}>Ne</button>
        <button type="button" onClick={() => this.close(true)}>Ano</button>
      </>
    );
  }

  render() {
    return <p>{this.props.question}</p>;
  }
}
