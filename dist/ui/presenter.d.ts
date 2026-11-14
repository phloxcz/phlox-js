/** Presenter: a component that URL leads to. Presenters form a tree and split the URL among themselves. */
import type { Child } from './dom';
import { Component, IS_PRESENTER } from './component';
import type { Class } from '../di/container';
import type { DialogOptions } from './dialog';
export type Params = Record<string, string>;
export type LinkParams = Record<string, string | number | boolean | null | undefined>;
/** Parameters of a route converted by their types: `<id:int>` is a number, the others texts. */
export type RouteParams = Record<string, string | number>;
type AnyPresenter = Presenter<any, any>;
type PresenterClass = Class<AnyPresenter>;
export interface Route {
    /** Name of the route. Route `detail` calls the method `actionDetail(params)`. */
    name: string;
    /** Part of the URL, for example `/users/<id \d+>`. A parameter without a regular expression takes one segment. */
    pattern: string;
    /** Presenter shown in <RouteFrame />, it handles the rest of the URL. A function loads it lazily: `() => import('./X')`. */
    presenter?: PresenterClass | (() => Promise<PresenterClass | {
        default: PresenterClass;
    }>);
    /**
     * Props of the presenter of the route, made from the parameters: `({ id }) => ({ projectId: Number(id) })`.
     * The presenter is created again when the parameters change, so its props never change.
     */
    props?(params: RouteParams): object;
    /**
     * Component shown in a dialog while the route is active: returns its class, props and how it is shown,
     * e.g. `[ItemEdit, { id }, { placement: 'end' }]` for a panel sliding in from the right.
     */
    dialog?(params: RouteParams): [Class<Component<any, any>>, object] | [Class<Component<any, any>>, object, DialogOptions];
    /** Called when the dialog of the route is closed. The result is undefined when navigation closed it. */
    closed?: (result: any) => void;
}
/** One parameter of a pattern: `id:int` is a number, `id` or `id \d+` a text. */
type ParamOf<Inside extends string> = Inside extends `${infer Name}:int` ? {
    [K in Name]: number;
} : Inside extends `${infer Name} ${string}` ? {
    [K in Name]: string;
} : {
    [K in Inside]: string;
};
/** The parameters of a pattern with their types: RouteParamsOf<'/<project:int>/<slug>'> is { project: number; slug: string }. */
export type RouteParamsOf<Pattern extends string> = Pattern extends `${string}<${infer Inside}>${infer Rest}` ? ParamOf<Inside> & RouteParamsOf<Rest> : {};
/** A route made by route(): it knows the types of its parameters, so link() checks them. */
export interface TypedRoute<P extends object> extends Route {
    /** Only for the compiler, it is never set. */
    readonly params?: P;
}
export interface RouteOptions<P extends object> {
    presenter?: Route['presenter'];
    props?: (params: P) => object;
    dialog?: (params: P) => [Class<Component<any, any>>, object] | [Class<Component<any, any>>, object, DialogOptions];
    closed?: (result: any) => void;
}
/**
 * A route with typed parameters: `route('detail', '/<task:int>', { presenter: TaskDetail, props: ({ task }) => ({ taskId: task }) })`.
 * `task` is a number in props and dialog, and link(this.detail, { task: 5 }) is checked by the compiler.
 */
export declare function route<const Pattern extends string>(name: string, pattern: Pattern, options?: RouteOptions<RouteParamsOf<Pattern>>): TypedRoute<RouteParamsOf<Pattern>>;
/** The parameters of link() for a route: none may be left out, more go to the query. */
export type LinkArgs<P extends object> = {} extends P ? [params?: LinkParams] : [params: P & LinkParams];
/** The dialog a presenter shows for its current route. */
export interface RoutedDialog {
    route: Route;
    key: string;
    component: Component<any, any>;
    result: unknown;
}
export declare class BadRequestError extends Error {
    readonly code: number;
    constructor(code?: number, message?: string);
}
export declare abstract class Presenter<P extends object = {}, R = void> extends Component<P, R> {
    readonly [IS_PRESENTER] = true;
    /** Routes of the presenter, tried in this order. */
    routes: Route[];
    /**
     * Query parameters the links of this presenter and of those below it keep, like #[Persistent] in Nette:
     * with ['page'], link('detail', { id: 5 }) on ?page=2 leads to /5?page=2. A name ending with * stands
     * for all that start with it, e.g. 'filter.*'. A parameter given to link() wins, null leaves it out.
     */
    persistent: string[];
    /** Name of the current route, null when no route matches. */
    readonly route: import("..").State<string | null>;
    /** Parameters of the current route. A presenter whose route has no child presenter gets query parameters too. */
    readonly params: import("..").State<Params>;
    /** Presenter shown in <RouteFrame />. */
    readonly child: import("..").State<AnyPresenter | null>;
    /** The part of the URL handled by the presenters above. */
    readonly basePath: import("..").State<string>;
    /** Used by the router to tell what has changed since the last navigation. */
    readonly routing: {
        matchKey: string;
        actionKey: string;
        dialog: RoutedDialog | null;
    };
    /**
     * Goes to another URL, the arguments are the same as in link(). It replaces the current history entry
     * and runs the action of this presenter again. Unlike in Nette it does not end the method,
     * write `return this.redirect(...)`.
     */
    redirect<P extends object>(destination: TypedRoute<P>, ...params: LinkArgs<P>): void;
    redirect(destination: string, params?: LinkParams): void;
    /** Ends the action with an error, like $this->error() in Nette. */
    error(code?: number, message?: string): never;
    /**
     * The title of the page, like {block title} in Nette. The deepest presenter with a title gives
     * document.title, composed by app.formatTitle(). It may read state: `() => this.task()?.name`.
     */
    pageTitle(): string | null;
    /** Called when the rest of the URL matches no route of this presenter. Override it to show something else. */
    notFound(path: string): void;
}
/** The place in render() of a presenter where the presenter of its current route is shown. */
export declare function RouteFrame(): Child;
export {};
