/** Whether the browser is online, as state: `<If when={() => !online()}>Offline</If>`. */

import { state } from '../reactive/reactive';
import type { Accessor } from '../reactive/reactive';

const current = state(typeof navigator === 'undefined' ? true : navigator.onLine);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => current.set(true));
  window.addEventListener('offline', () => current.set(false));
}

/**
 * True while the browser has a network. It says the device is connected, not that the server answers;
 * RpcOffline treats a failed request as offline too.
 */
export const online: Accessor<boolean> = current;
