/** Tipos del relay `server.mjs` (proceso Node; se levanta al importar). */
export type ServerLike = { close(cb?: () => void): unknown };
export declare const server: ServerLike;
/** Host de escucha activo (127.0.0.1 por defecto; LAN solo por opt-in). */
export declare const BIND_HOST: string;
/** Cierra el listener para tests. */
export declare function closeServer(): Promise<void>;
