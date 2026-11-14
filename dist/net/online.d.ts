/** Whether the browser is online, as state: `<If when={() => !online()}>Offline</If>`. */
import type { Accessor } from '../reactive/reactive';
/**
 * True while the browser has a network. It says the device is connected, not that the server answers;
 * RpcOffline treats a failed request as offline too.
 */
export declare const online: Accessor<boolean>;
