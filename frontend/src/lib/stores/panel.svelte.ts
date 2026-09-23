import { pb } from '$lib/pocketbase';
import type { Agencia, Operador, Ventanilla } from '$lib/tipos';

/** Datos de contexto del operador: su agencia y su ventanilla. */
class Panel {
	agencia = $state<Agencia | null>(null);
	ventanilla = $state<Ventanilla | null>(null);
	private cargadoPara = '';

	async cargar(operador: Operador) {
		if (this.cargadoPara === operador.id) return;
		this.cargadoPara = operador.id;
		const [agencia, ventanilla] = await Promise.all([
			pb.collection('agencias').getOne<Agencia>(operador.agencia),
			operador.ventanilla
				? pb.collection('ventanillas').getOne<Ventanilla>(operador.ventanilla)
				: Promise.resolve(null)
		]);
		this.agencia = agencia;
		this.ventanilla = ventanilla;
	}

	limpiar() {
		this.cargadoPara = '';
		this.agencia = null;
		this.ventanilla = null;
	}
}

export const panel = new Panel();
