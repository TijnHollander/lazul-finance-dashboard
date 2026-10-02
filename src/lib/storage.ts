import { writable, type Writable } from 'svelte/store';

/**
 * Een Svelte-store die zichzelf in localStorage bewaart.
 * Alle data blijft in de browser van de gebruiker; er is geen database.
 */
export const STORAGE_PREFIX = 'lazul:';

export function persisted<T>(key: string, initial: T): Writable<T> {
	const fullKey = STORAGE_PREFIX + key;
	let start = initial;
	try {
		const raw = localStorage.getItem(fullKey);
		if (raw != null) {
			const parsed = JSON.parse(raw);
			const isPlainObj = (o: unknown) => o !== null && typeof o === 'object' && !Array.isArray(o);
			start = isPlainObj(initial) && isPlainObj(parsed) ? ({ ...(initial as object), ...parsed } as T) : parsed;
		}
	} catch {
		/* geen opslag beschikbaar of corrupte data */
	}
	const store = writable<T>(start);
	store.subscribe((v) => {
		try {
			localStorage.setItem(fullKey, JSON.stringify(v));
		} catch (e) {
			console.warn('Opslaan mislukt', e);
		}
	});
	return store;
}

/** Alle Lazul-data als één JSON-object (voor back-up). */
export function exportAll(): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i)!;
		if (k.startsWith(STORAGE_PREFIX)) out[k.slice(STORAGE_PREFIX.length)] = JSON.parse(localStorage.getItem(k)!);
	}
	return out;
}

export function importAll(data: Record<string, unknown>) {
	for (const [k, v] of Object.entries(data)) localStorage.setItem(STORAGE_PREFIX + k, JSON.stringify(v));
}

export function wipeAll() {
	const keys: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i)!;
		if (k.startsWith(STORAGE_PREFIX)) keys.push(k);
	}
	keys.forEach((k) => localStorage.removeItem(k));
	sessionStorage.clear();
}
