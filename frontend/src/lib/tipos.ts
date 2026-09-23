import type { RecordModel } from 'pocketbase';

export type Canal = 'ventanilla' | 'plataforma';
export type EstadoTurno = 'en_espera' | 'atendiendo' | 'atendido' | 'cancelado' | 'no_asistio';
export type TipoDocumento = 'DNI' | 'CE' | 'PASAPORTE' | 'PTP';
export type TipoPrioridad = 'adulto_mayor' | 'gestante' | 'discapacidad';
export type NivelCongestion = 'baja' | 'media' | 'alta';

export interface Agencia extends RecordModel {
	nombre: string;
	region: string;
	direccion: string;
	hora_apertura: string;
	hora_cierre: string;
	activa: boolean;
}

export interface Ventanilla extends RecordModel {
	agencia: string;
	numero: number;
	activa: boolean;
}

export interface Servicio extends RecordModel {
	nombre: string;
	duracion_min: number;
	orden: number;
	activo: boolean;
}

export interface Cliente extends RecordModel {
	tipo_documento: TipoDocumento;
	numero_documento: string;
	nombres: string;
	verificado_legado: boolean;
}

export interface Operador extends RecordModel {
	usuario: string;
	name: string;
	rol: 'operador' | 'admin';
	agencia: string;
	ventanilla: string;
}

export interface Turno extends RecordModel {
	codigo: string;
	agencia: string;
	servicio: string;
	cliente: string;
	canal: Canal;
	prioridad: boolean;
	tipo_prioridad: TipoPrioridad | '';
	fecha: string;
	hora: string;
	estado: EstadoTurno;
	ventanilla: string;
	operador: string;
	monto_aprox: number;
	observacion: string;
	enlace_meet: string;
	llamado_en: string;
	finalizado_en: string;
	expand?: {
		servicio?: Servicio;
		agencia?: Agencia;
		cliente?: Cliente;
		ventanilla?: Ventanilla;
	};
}

export interface Franja {
	hora: string;
	probabilidad: number;
	nivel: NivelCongestion;
	reservadas: number;
	cupos_libres: number;
	disponible: boolean;
	recomendado: boolean;
}

export interface RespuestaHorarios {
	agencia: string;
	fecha: string;
	ventanillas_activas: number;
	capacidad_por_franja: number;
	franjas: Franja[];
	sugeridas: string[];
}

export interface ItemCola {
	id: string;
	codigo: string;
	servicio: string;
	canal: Canal;
	estado: EstadoTurno;
	prioridad: boolean;
	hora: string;
	ventanilla: number | null;
	llamado_en: string;
	posicion: number;
	espera_min: number;
}

export interface RespuestaCola {
	agencia: string;
	fecha: string;
	ventanillas_activas: number;
	turnos: ItemCola[];
}

export interface Indicadores {
	fecha: string;
	total: number;
	en_espera: number;
	atendiendo: number;
	atendidos: number;
	cancelados: number;
	no_asistio: number;
	prom_espera_min: number;
	prom_atencion_min: number;
}

export interface FilaReporte {
	fecha: string;
	franja: string;
	tramite: string;
	canal: Canal;
	total: number;
	atendidos: number;
	cancelados: number;
	no_asistio: number;
	prioritarios: number;
}
