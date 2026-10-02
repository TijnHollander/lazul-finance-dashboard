import { send } from './_lib.js';
export default function handler(req, res) {
	send(res, 200, { ok: true, provider: 'yahoo' }, 300);
}
