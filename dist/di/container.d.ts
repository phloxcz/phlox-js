/**
 * Dependency injection container with autowiring, like the one in Nette.
 * A class says what it needs by `static $inject = () => [Dependency, ...]`.
 * The Vite plugin in vite.ts writes that line from the types of constructor parameters.
 */
export type Type<T = unknown> = abstract new (...args: any[]) => T;
export type Class<T = unknown> = new (...args: any[]) => T;
export declare class Container {
    /** Registered classes and their instances, undefined until the service is first needed. */
    private services;
    private creating;
    /** Registers services: a class is created when first needed, an instance is used as it is. */
    add(...services: (Class | object)[]): this;
    /** Lets an extension register its services, like `extensions` in NEON. */
    use(extension: (container: Container) => void): this;
    has(type: Type): boolean;
    /** Returns the only service of the given type: the class itself or a class that extends it. */
    get<T>(type: Type<T>): T;
    /** Creates an instance with autowired constructor. The instance is not registered as a service. */
    create<T>(cls: Class<T>): T;
    private find;
}
