import { ClientResponseError } from 'pocketbase';
import type { Canal, EstadoTurno, NivelCongestion, TipoDocumento, TipoPrioridad } from './tipos';

const OFFSET_PERU_MS = -5 * 60 * 60 * 1000;

/** Fecha de hoy (YYYY-MM-DD) en hora de Perú, sin importar la zona horaria del equipo. */
export function hoyPeru(): string {
	return new Date(Date.now() + OFFSET_PERU_MS).toISOString().slice(0, 10);
}

/** Hora actual (HH:MM) en Perú. */
export function horaPeru(): string {
	return new Date(Date.now() + OFFSET_PERU_MS).toISOString().slice(11, 16);
}

export function sumarDias(fecha: string, dias: number): string {
	const d = new Date(`${fecha}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + dias);
	return d.toISOString().slice(0, 10);
}

export function esDomingo(fecha: string): boolean {
	return new Date(`${fecha}T12:00:00Z`).getUTCDay() === 0;
}

/** Minutos que faltan para una fecha/hora local de Perú (negativo si ya pasó). */
export function minutosHasta(fecha: string, hora: string): number {
	const objetivo = Date.parse(`${fecha}T${hora}:00Z`) - OFFSET_PERU_MS;
	return Math.round((objetivo - Date.now()) / 60000);
}

/** 12/09/2026 */
export function fechaCorta(fecha: string): string {
	const [a, m, d] = fecha.split('-');
	return `${d}/${m}/${a}`;
}

/** "jueves 24 de septiembre" */
export function fechaLarga(fecha: string): string {
	return new Intl.DateTimeFormat('es-PE', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: 'UTC'
	}).format(new Date(`${fecha}T12:00:00Z`));
}

/** "10:30 am" */
export function hora12(hora: string): string {
	const [h, m] = hora.split(':').map(Number);
	const sufijo = h < 12 ? 'am' : 'pm';
	const h12 = h % 12 === 0 ? 12 : h % 12;
	return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

/** Hora local de Perú a partir de un campo date de PocketBase. */
export function horaDeCampo(valor: string): string {
	if (!valor) return '';
	const ms = Date.parse(valor.replace(' ', 'T'));
	if (Number.isNaN(ms)) return '';
	return hora12(new Date(ms + OFFSET_PERU_MS).toISOString().slice(11, 16));
}

export function soles(monto: number): string {
	return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(monto || 0);
}

/** 71234231 -> ****231 (como en los wireframes). */
export function enmascarar(numero: string): string {
	if (!numero) return '';
	return `****${numero.slice(-3)}`;
}

/** 71234231 -> 71***231 (ficha del operador). */
export function enmascararParcial(numero: string): string {
	if (!numero || numero.length < 6) return numero;
	return `${numero.slice(0, 2)}${'*'.repeat(numero.length - 5)}${numero.slice(-3)}`;
}

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
	DNI: 'DNI',
	CE: 'Carné de extranjería',
	PASAPORTE: 'Pasaporte',
	PTP: 'PTP'
};

export const NOMBRE_CANAL: Record<Canal, string> = {
	ventanilla: 'Ventanilla',
	plataforma: 'Plataforma virtual'
};

export const NOMBRE_ESTADO: Record<EstadoTurno, string> = {
	en_espera: 'En espera',
	atendiendo: 'Atendiéndose',
	atendido: 'Atendido',
	cancelado: 'Cancelado',
	no_asistio: 'No asistió'
};

export const NOMBRE_PRIORIDAD: Record<TipoPrioridad, string> = {
	adulto_mayor: 'Adulto mayor',
	gestante: 'Gestante',
	discapacidad: 'Persona con discapacidad'
};

export const NOMBRE_NIVEL: Record<NivelCongestion, string> = {
	baja: 'Poca gente',
	media: 'Afluencia media',
	alta: 'Mucha gente'
};

/** Mensaje legible a partir de cualquier error del SDK de PocketBase. */
export function mensajeError(err: unknown): string {
	if (err instanceof ClientResponseError) {
		if (err.status === 0)
			return 'No hay conexión con el servidor. Revisa tu red e inténtalo otra vez.';
		const datos = err.response?.data as Record<string, { message?: string }> | undefined;
		const primero = datos ? Object.values(datos)[0]?.message : undefined;
		if (err.status === 400 && err.response?.message === 'Failed to authenticate.') {
			return 'Usuario o contraseña incorrectos.';
		}
		return err.response?.message || primero || 'No se pudo completar la operación.';
	}
	if (err instanceof Error) return err.message;
	return 'No se pudo completar la operación.';
}
