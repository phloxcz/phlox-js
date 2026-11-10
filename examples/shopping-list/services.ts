// Services of the application, the counterpart of `services` in config.neon.
import { Container } from 'phlox-js';
import { ShoppingStore } from './model/ShoppingStore';
import { translator } from './i18n';

export const services = new Container().add(ShoppingStore, translator);
