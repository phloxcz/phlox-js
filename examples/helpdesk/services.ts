// Services of the helpdesk, the counterpart of `services` in config.neon.
import { BootstrapTheme, Container, FlashMessages } from 'phlox-js';
import { BrowserUserStorage, User } from 'phlox-js/security';
import { HelpdeskApi } from './api';
import { ApiAuthenticator } from './model/ApiAuthenticator';
import { Store } from './model/Store';

export const services = new Container();

services.add(new HelpdeskApi('/helpdesk/rpc', {
  headers: () => {
    const token = services.get(User).token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
}));
// Toasts at the bottom, the header has the notifications and the user at the top right
const flashes = new FlashMessages();
flashes.position = 'bottom-right';

// The identity under its own key, other examples on the same site have their own users
services.add(flashes, new BrowserUserStorage('helpdesk.identity'), ApiAuthenticator, Store);
// Built on Bootstrap: controls, dialogs and toasts of the framework get its classes
services.add(new BootstrapTheme());
