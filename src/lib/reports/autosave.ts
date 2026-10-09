import type { Writable } from 'svelte/store';
import type { Saved } from '$lib/stores';

/** Slaat een rapport automatisch op zodra de gebruiker iets wijzigt (niet al bij het openen). */
export function autosave<T>(store: Writable<Saved<T>>, getData: () => T, alreadySaved: boolean) {
	let first = JSON.stringify(getData());
	let active = alreadySaved;
	return () => {
		const now = JSON.stringify(getData());
		if (!active && now === first) return;
		active = true;
		first = now;
		store.set({ data: JSON.parse(now), savedAt: new Date().toISOString() });
	};
}
