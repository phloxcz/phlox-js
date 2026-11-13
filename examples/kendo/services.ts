// Services of the Kendo example: Bootstrap for the framework, Kendo UI for the widgets and windows.
import { BootstrapTheme, Container } from 'phlox-js';
import { Kendo, KendoDialogs } from 'phlox-js/adapters/kendo';
import type { KendoLike } from 'phlox-js/adapters/kendo';
import { Orders } from './model/Orders';

export function createServices(kendo: KendoLike): Container {
  return new Container()
    .add(new BootstrapTheme(), Orders)
    // Dialogs of the framework open in Kendo Window instead of the native <dialog>
    .add(new Kendo(kendo), KendoDialogs);
}
