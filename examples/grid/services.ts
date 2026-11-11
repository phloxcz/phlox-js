// Services of the example, the counterpart of `services` in config.neon.
import { BootstrapTheme, Container } from 'phlox-js';
import { bootstrap } from '../shared/appearance';
import { OrderStore } from './model/OrderStore';

export const services = new Container().add(OrderStore);

if (bootstrap) services.add(new BootstrapTheme());
