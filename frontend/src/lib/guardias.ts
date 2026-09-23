import { redirect } from '@sveltejs/kit';
import { pb } from '$lib/pocketbase';

/** Exige una sesión de personal de agencia (colección users). */
export function exigirPersonal() {
	if (!pb.authStore.isValid || pb.authStore.record?.collectionName !== 'users') {
		redirect(307, '/ventanilla');
	}
}

/** Exige una sesión de responsable de agencia (rol admin). */
export function exigirAdmin() {
	exigirPersonal();
	if (pb.authStore.record?.rol !== 'admin') {
		redirect(307, '/ventanilla/cola');
	}
}
