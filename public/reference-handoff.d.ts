export function put(owner: string, file: File): Promise<string>;
export function take(token: string, owner: string): Promise<File | null>;
export function validToken(token: unknown): boolean;
export function validRecord(record: unknown, owner: string, now: number): boolean;
export const MAX_BYTES: number;
export const TTL: number;
