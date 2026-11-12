import { Authenticator, Identity } from 'phlox-js/security';
import { HelpdeskApi } from '../api';

/** Login by the e-mail and the password through the API, like an Authenticator in Nette. */
export class ApiAuthenticator extends Authenticator {
  constructor(private api: HelpdeskApi) {
    super();
  }

  async authenticate(email: string, password: string): Promise<Identity> {
    const { token, user } = await this.api.call('sign.in', { email, password });
    return new Identity(user.id, [], { name: user.name, email: user.email }, token);
  }
}
