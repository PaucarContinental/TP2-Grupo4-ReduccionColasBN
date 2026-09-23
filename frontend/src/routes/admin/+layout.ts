import { exigirAdmin } from '$lib/guardias';

export const load = () => {
	exigirAdmin();
};
