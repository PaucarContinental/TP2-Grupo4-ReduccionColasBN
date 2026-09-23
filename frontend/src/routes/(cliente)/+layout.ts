import { redirect } from '@sveltejs/kit';
import { pb } from '$lib/pocketbase';

// Solo clientes identificados con su documento pueden entrar a estas vistas.
export const load = () => {
	if (!pb.authStore.isValid || pb.authStore.record?.collectionName !== 'clientes') {
		redirect(307, '/');
	}
};
