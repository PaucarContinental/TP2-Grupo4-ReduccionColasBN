import type { RecordModel } from 'pocketbase';
import { pb } from '$lib/pocketbase';
import type { Cliente, Operador } from '$lib/tipos';

/** Estado reactivo de la sesión (cliente del banco u operador de agencia). */
class Sesion {
	registro = $state<RecordModel | null>(pb.authStore.record);
	token = $state(pb.authStore.token);

	constructor() {
		pb.authStore.onChange((token, record) => {
			this.token = token;
			this.registro = record;
		});
	}

	get valida(): boolean {
		return this.token !== '' && pb.authStore.isValid;
	}

	get cliente(): Cliente | null {
		return this.valida && this.registro?.collectionName === 'clientes'
			? (this.registro as Cliente)
			: null;
	}

	get operador(): Operador | null {
		return this.valida && this.registro?.collectionName === 'users'
			? (this.registro as Operador)
			: null;
	}

	get esAdmin(): boolean {
		return this.operador?.rol === 'admin';
	}

	salir() {
		pb.realtime.unsubscribe().catch(() => {});
		pb.authStore.clear();
	}
}

export const sesion = new Sesion();
