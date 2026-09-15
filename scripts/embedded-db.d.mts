export declare const PG_PORT: number
export declare function isPortOpen(port: number, host?: string): Promise<boolean>
export declare function startEmbeddedDb(databases: string[]): Promise<{ stop: () => Promise<void> }>
