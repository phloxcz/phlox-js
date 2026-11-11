// Services of the application, the counterpart of `services` in config.neon.
import * as Capify from '@phloxcz/capify';
import '@phloxcz/capify/capify.css';
import { Container } from 'phlox-js';
import { CapifyFlashMessages } from 'phlox-js/adapters/capify';
import { ShoppingStore } from './model/ShoppingStore';
import { translator } from './i18n';

export const services = new Container()
  .add(ShoppingStore, translator)
  // Flash messages as capify toasts, instead of the default service that keeps them for the layout
  .add(new CapifyFlashMessages(Capify, { position: 'top-right' }));
