// src/di/container.ts
var Container = class {
	/** Registered classes and their instances, undefined until the service is first needed. */
	services = /* @__PURE__ */ new Map();
	creating = /* @__PURE__ */ new Set();
	/** Registers services: a class is created when first needed, an instance is used as it is. */
	add(...services) {
		for (const service of services) if (typeof service === "function") this.services.set(service, void 0);
		else this.services.set(service.constructor, service);
		return this;
	}
	/** Lets an extension register its services, like `extensions` in NEON. */
	use(extension) {
		extension(this);
		return this;
	}
	has(type) {
		return this.find(type).length > 0;
	}
	/** Returns the only service of the given type: the class itself or a class that extends it. */
	get(type) {
		const found = this.find(type);
		if (found.length === 0) throw new Error(`Service of type ${type.name} not found. Did you add it to the container?`);
		if (found.length > 1) throw new Error(`Multiple services of type ${type.name} found: ${found.map((cls) => cls.name).join(", ")}.`);
		const cls = found[0];
		if (this.services.get(cls) === void 0) this.services.set(cls, this.create(cls));
		return this.services.get(cls);
	}
	/** Creates an instance with autowired constructor. The instance is not registered as a service. */
	create(cls) {
		if (this.creating.has(cls)) throw new Error(`Circular dependency while creating ${cls.name}.`);
		const inject = cls.$inject;
		if (!inject && cls.length > 0) throw new Error(`Cannot autowire ${cls.name}: add the phlox plugin to Vite or define static $inject.`);
		this.creating.add(cls);
		try {
			return new cls(...(inject?.() ?? []).map((dependency) => {
				if (typeof dependency === "function") return this.get(dependency);
				throw new Error(`Cannot autowire parameter '${dependency}' of ${cls.name}: its type is not a class.`);
			}));
		} finally {
			this.creating.delete(cls);
		}
	}
	find(type) {
		return [...this.services.keys()].filter((cls) => cls === type || cls.prototype instanceof type);
	}
};
export { Container };
