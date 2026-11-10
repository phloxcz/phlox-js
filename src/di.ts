/**
 * Dependency injection container with autowiring, like the one in Nette.
 * A class says what it needs by `static $inject = () => [Dependency, ...]`.
 * The Vite plugin in vite.ts writes that line from the types of constructor parameters.
 */

export type Type<T = unknown> = abstract new (...args: any[]) => T;
export type Class<T = unknown> = new (...args: any[]) => T;

/** A dependency is a class, or a text describing a parameter that cannot be autowired. */
type Dependency = Type | string | undefined;

export class Container {
  /** Registered classes and their instances, undefined until the service is first needed. */
  private services = new Map<Class, unknown>();
  private creating = new Set<Class>();

  /** Registers services: a class is created when first needed, an instance is used as it is. */
  add(...services: (Class | object)[]): this {
    for (const service of services) {
      if (typeof service === 'function') this.services.set(service as Class, undefined);
      else this.services.set(service.constructor as Class, service);
    }
    return this;
  }

  /** Lets an extension register its services, like `extensions` in NEON. */
  use(extension: (container: Container) => void): this {
    extension(this);
    return this;
  }

  has(type: Type): boolean {
    return this.find(type).length > 0;
  }

  /** Returns the only service of the given type: the class itself or a class that extends it. */
  get<T>(type: Type<T>): T {
    const found = this.find(type);
    if (found.length === 0) throw new Error(`Service of type ${type.name} not found. Did you add it to the container?`);
    if (found.length > 1) {
      throw new Error(`Multiple services of type ${type.name} found: ${found.map(cls => cls.name).join(', ')}.`);
    }
    const cls = found[0]!;
    if (this.services.get(cls) === undefined) this.services.set(cls, this.create(cls));
    return this.services.get(cls) as T;
  }

  /** Creates an instance with autowired constructor. The instance is not registered as a service. */
  create<T>(cls: Class<T>): T {
    if (this.creating.has(cls)) throw new Error(`Circular dependency while creating ${cls.name}.`);
    const inject = (cls as { $inject?: () => Dependency[] }).$inject;
    if (!inject && cls.length > 0) {
      throw new Error(`Cannot autowire ${cls.name}: add the phlox plugin to Vite or define static $inject.`);
    }

    this.creating.add(cls);
    try {
      const args = (inject?.() ?? []).map(dependency => {
        if (typeof dependency === 'function') return this.get(dependency);
        throw new Error(`Cannot autowire parameter '${dependency}' of ${cls.name}: its type is not a class.`);
      });
      return new cls(...args);
    } finally {
      this.creating.delete(cls);
    }
  }

  private find(type: Type): Class[] {
    return [...this.services.keys()].filter(cls => cls === type || cls.prototype instanceof type);
  }
}
