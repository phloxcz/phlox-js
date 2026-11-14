/**
 * Vite plugin for autowiring. TypeScript types do not exist at runtime, so the plugin reads
 * the constructor of every class and writes down what it needs:
 *
 *   constructor(private api: UserApi) {}   →   static $inject = () => [UserApi];
 *
 * It reads syntax only. Every type is taken through a namespace import of its module, so a type
 * that is not a class is simply undefined at runtime and the container reports it when it creates the class.
 */
import type { Plugin } from 'vite';
export declare function phlox(options?: {
    exclude?: RegExp;
}): Plugin;
