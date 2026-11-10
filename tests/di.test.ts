import { describe, expect, test } from 'vitest';
import { Container } from '../src/di/container';

// Constructors below are autowired by the Vite plugin from vite.config.ts, there is no $inject written by hand.

interface Options { size: number }

abstract class Authorizator {
  abstract allowed(): boolean;
}
class AppAuthorizator extends Authorizator {
  allowed() { return true; }
}
class OtherAuthorizator extends Authorizator {
  allowed() { return false; }
}

class Http {
  name = 'http';
}
class UserApi {
  constructor(public http: Http) {}
}
class Screen {
  constructor(public api: UserApi, public auth: Authorizator) {}
}
class InheritedConstructor extends Screen {}

class Point {
  constructor(public x: number, public y: number) {}
}
class WithScalar {
  constructor(public http: Http, public size: number) {}
}
class WithInterface {
  constructor(public http: Http, public options: Options) {}
}
class WithGeneric {
  constructor(public http: Http, public list: Array<Http>) {}
}
class WithDefault {
  constructor(public http: Http = new Http()) {}
}
class CycleA {
  constructor(public b: CycleB) {}
}
class CycleB {
  constructor(public a: CycleA) {}
}
class Config {
  constructor(public url: string) {}
}

describe('Container', () => {
  test('autowires a constructor from its types, services are created once', () => {
    const container = new Container().add(Http, UserApi, AppAuthorizator);
    const first = container.create(Screen);
    const second = container.create(Screen);
    expect(first.api.http.name).toBe('http');
    expect(first.auth.allowed()).toBe(true);
    expect(first).not.toBe(second);
    expect(first.api).toBe(second.api);
    expect(container.get(UserApi)).toBe(first.api);
  });

  test('finds a service by its abstract parent', () => {
    const container = new Container().add(AppAuthorizator);
    expect(container.get(Authorizator)).toBeInstanceOf(AppAuthorizator);
  });

  test('an inherited constructor is autowired too', () => {
    const container = new Container().add(Http, UserApi, AppAuthorizator);
    expect(container.create(InheritedConstructor).api.http.name).toBe('http');
  });

  test('a parameter with a default value is autowired by its type', () => {
    const container = new Container().add(Http);
    expect(container.create(WithDefault).http).toBe(container.get(Http));
  });

  test('an instance is registered as it is, also one with scalar parameters', () => {
    const config = new Config('/api');
    const container = new Container().add(config);
    expect(container.get(Config)).toBe(config);
  });

  test('use() lets an extension add services', () => {
    const container = new Container().use(c => c.add(Http));
    expect(container.has(Http)).toBe(true);
    expect(container.has(UserApi)).toBe(false);
  });

  test('an ordinary class is left alone', () => {
    expect(new Point(1, 2).y).toBe(2);
    expect('$inject' in Point).toBe(false);
  });

  test('reports a missing service', () => {
    expect(() => new Container().add(Http).create(Screen)).toThrow('Service of type UserApi not found');
  });

  test('reports an ambiguous service', () => {
    const container = new Container().add(Http, UserApi, AppAuthorizator, OtherAuthorizator);
    expect(() => container.create(Screen)).toThrow('Multiple services of type Authorizator found: AppAuthorizator, OtherAuthorizator');
  });

  test('reports what cannot be autowired: scalar, interface, generic', () => {
    const container = new Container().add(Http);
    expect(() => container.create(WithScalar)).toThrow("Cannot autowire parameter 'size: number' of WithScalar");
    expect(() => container.create(WithInterface)).toThrow("Cannot autowire parameter 'options: Options' of WithInterface");
    expect(() => container.create(WithGeneric)).toThrow("Cannot autowire parameter 'list: Array<Http>' of WithGeneric");
    expect(() => container.create(Point)).toThrow('Cannot autowire Point');
  });

  test('reports a circular dependency', () => {
    expect(() => new Container().add(CycleA, CycleB).get(CycleA)).toThrow('Circular dependency');
  });
});
