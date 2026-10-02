/** Lokale "login": alleen een pincode-hash in localStorage. Dit is privacy op je eigen apparaat, geen echte beveiliging. */
export async function hashPin(pin: string): Promise<string> {
	const data = new TextEncoder().encode('lazul-salt::' + pin);
	const buf = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
