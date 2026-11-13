// Services of the helpdesk, the counterpart of `services` in config.neon.
import { BootstrapTheme, Container, FlashMessages } from 'phlox-js';
import { BrowserUserStorage, User } from 'phlox-js/security';
import { HelpdeskApi } from './api';
import { ApiAuthenticator } from './model/ApiAuthenticator';
import { OfflineWork, createOffline } from './model/offline';
import { Store } from './model/Store';

export interface ServiceOptions {
  /** Another fetch for the API, e.g. a mock server in tests (createRpcMock). */
  fetch?: typeof fetch;
}

/** The services of the application; tests make them with the mock server instead of the network. */
export function createServices(options: ServiceOptions = {}): Container {
  const services = new Container();
  // Working offline: kept data and a queue of changes, per signed-in user
  const offline = createOffline(() => Number(services.get(User).getId()));

  services.add(offline, OfflineWork, new HelpdeskApi('/helpdesk/rpc', {
    offline,
    headers: () => {
      const token = services.get(User).token;
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
    ...(options.fetch ? { fetch: options.fetch } : {}),
  }));
  // Toasts at the bottom, the header has the notifications and the user at the top right
  const flashes = new FlashMessages();
  flashes.position = 'bottom-right';

  // The identity under its own key, other examples on the same site have their own users
  services.add(flashes, new BrowserUserStorage('helpdesk.identity'), ApiAuthenticator, Store);
  // Built on Bootstrap: controls, dialogs and toasts of the framework get its classes
  services.add(new BootstrapTheme());
  return services;
}
