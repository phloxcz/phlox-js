import { Presenter } from 'phlox-js';

/** Loaded with the first visit of its route: a file of its own in the build. The export must be default. */
export default class ReportsPresenter extends Presenter {
  render() {
    return <p>Reporty se načetly až teď, samostatným souborem.</p>;
  }
}
