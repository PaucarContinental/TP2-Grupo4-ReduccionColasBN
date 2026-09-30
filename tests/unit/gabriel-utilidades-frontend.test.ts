/**
 * PRUEBAS UNITARIAS — Utilidades de la interfaz (frontend/src/lib/util.ts)
 * Responsable: Rye Gabriel Gregory Paucar Quejia (Gerente de TI / Responsable del proyecto)
 *
 * Validan lo que el usuario ve en pantalla: fechas y horas en hora de Perú, formato del
 * ticket, enmascarado del documento y los mensajes de error. Son funciones puras, por lo
 * que se prueban sin navegador ni servidor. Donde interviene el reloj, se fija Date.now
 * para que la prueba sea repetible a cualquier hora del día.
 */
import { expect } from 'chai';
import { ClientResponseError } from 'pocketbase';
import {
	NOMBRE_CANAL,
	NOMBRE_ESTADO,
	enmascarar,
	enmascararParcial,
	esDomingo,
	fechaCorta,
	hora12,
	horaDeCampo,
	horaPeru,
	hoyPeru,
	mensajeError,
	minutosHasta,
	soles,
	sumarDias
} from '../../frontend/src/lib/util.ts';

/** Congela el reloj en un instante UTC y lo restaura al terminar cada prueba. */
function congelarReloj(isoUtc: string) {
	const original = Date.now;
	const fijo = Date.parse(isoUtc);
	Date.now = () => fijo;
	return () => (Date.now = original);
}

describe('Gabriel · Fechas y horas en hora de Perú', () => {
	let restaurar: () => void = () => {};
	afterEach(() => restaurar());

	it('a las 22:00 de Lima (03:00 UTC del día siguiente) sigue siendo el mismo día en Perú', () => {
		restaurar = congelarReloj('2026-09-30T03:00:00Z');
		expect(hoyPeru()).to.equal('2026-09-29');
		expect(horaPeru()).to.equal('22:00');
	});

	it('minutosHasta calcula los minutos que faltan para la cita', () => {
		restaurar = congelarReloj('2026-09-29T14:00:00Z'); // 09:00 en Lima
		expect(minutosHasta('2026-09-29', '09:45')).to.equal(45);
		expect(minutosHasta('2026-09-29', '08:30')).to.equal(-30);
	});

	it('sumarDias cruza fin de mes y fin de año', () => {
		expect(sumarDias('2026-09-30', 1)).to.equal('2026-10-01');
		expect(sumarDias('2026-12-31', 1)).to.equal('2027-01-01');
		expect(sumarDias('2026-03-01', -1)).to.equal('2026-02-28');
	});

	it('esDomingo reconoce el domingo (día sin atención)', () => {
		expect(esDomingo('2026-10-04')).to.equal(true);
		expect(esDomingo('2026-10-05')).to.equal(false);
	});
});

describe('Gabriel · Formato del ticket', () => {
	it('fechaCorta muestra la fecha como DD/MM/AAAA', () => {
		expect(fechaCorta('2026-09-12')).to.equal('12/09/2026');
	});

	it('hora12 usa el formato de 12 horas con am/pm', () => {
		expect(hora12('08:30')).to.equal('8:30 am');
		expect(hora12('12:00')).to.equal('12:00 pm');
		expect(hora12('17:05')).to.equal('5:05 pm');
		expect(hora12('00:15')).to.equal('12:15 am');
	});

	it('horaDeCampo convierte la fecha UTC de PocketBase a hora de Perú', () => {
		expect(horaDeCampo('2026-09-23 20:13:00.000Z')).to.equal('3:13 pm');
	});

	it('horaDeCampo devuelve vacío si el campo está vacío o es inválido', () => {
		expect(horaDeCampo('')).to.equal('');
		expect(horaDeCampo('no-es-fecha')).to.equal('');
	});

	it('soles muestra el monto en moneda peruana con dos decimales', () => {
		const texto = soles(3500).replace(/ /g, ' ');
		expect(texto).to.match(/^S\/\s?3,500\.00$/);
		expect(soles(0).replace(/ /g, ' ')).to.match(/0\.00$/);
	});
});

describe('Gabriel · Protección de datos en pantalla', () => {
	it('enmascarar deja visibles solo los 3 últimos dígitos (****231)', () => {
		expect(enmascarar('71234231')).to.equal('****231');
		expect(enmascarar('')).to.equal('');
	});

	it('enmascararParcial muestra inicio y fin para la ficha del operador (71***231)', () => {
		expect(enmascararParcial('71234231')).to.equal('71***231');
		expect(enmascararParcial('001234567')).to.equal('00****567');
	});

	it('enmascararParcial no altera documentos demasiado cortos', () => {
		expect(enmascararParcial('AB12')).to.equal('AB12');
	});
});

describe('Gabriel · Mensajes de error para el usuario', () => {
	it('sin conexión con el servidor pide revisar la red', () => {
		const err = new ClientResponseError({ status: 0 });
		expect(mensajeError(err)).to.contain('No hay conexión con el servidor');
	});

	it('traduce el error de autenticación de PocketBase al español', () => {
		const err = new ClientResponseError({
			status: 400,
			response: { message: 'Failed to authenticate.', data: {} }
		});
		expect(mensajeError(err)).to.equal('Usuario o contraseña incorrectos.');
	});

	it('muestra el mensaje de negocio que envía el backend', () => {
		const err = new ClientResponseError({
			status: 400,
			response: { message: 'El DNI debe tener exactamente 8 dígitos.', data: {} }
		});
		expect(mensajeError(err)).to.equal('El DNI debe tener exactamente 8 dígitos.');
	});

	it('nunca deja al usuario sin mensaje ante un error desconocido', () => {
		expect(mensajeError(new Error('Tiempo agotado'))).to.equal('Tiempo agotado');
		expect(mensajeError('???')).to.equal('No se pudo completar la operación.');
	});

	it('todos los estados y canales tienen un nombre legible', () => {
		for (const estado of ['en_espera', 'atendiendo', 'atendido', 'cancelado', 'no_asistio'] as const) {
			expect(NOMBRE_ESTADO[estado]).to.be.a('string').and.not.be.empty;
		}
		expect(NOMBRE_CANAL).to.deep.equal({ ventanilla: 'Ventanilla', plataforma: 'Plataforma virtual' });
	});
});
