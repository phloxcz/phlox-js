// Services of the application, the counterpart of `services` in config.neon.
import * as Capify from '@phloxcz/capify';
import '@phloxcz/capify/capify.css';
import { BootstrapTheme, Container } from 'phlox-js';
import { CapifyFlashMessages } from 'phlox-js/adapters/capify';
import { ShoppingStore } from './model/ShoppingStore';
import { translator } from './i18n';

/** The demo can show both themes: ?theme=bootstrap when the page is loaded. */
export const bootstrap = new URLSearchParams(location.search).get('theme') === 'bootstrap';

export const services = new Container()
  .add(ShoppingStore, translator)
  // Flash messages as capify toasts, instead of the default service that keeps them for the layout
  .add(new CapifyFlashMessages(Capify, { position: 'top-right', theme: bootstrap ? 'bootstrap' : 'default' }));

// Without a theme in the container the default one is used
if (bootstrap) services.add(new BootstrapTheme());
