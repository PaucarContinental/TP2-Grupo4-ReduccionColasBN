/**
 * PRUEBAS UNITARIAS — Lógica de negocio del backend (pb_hooks/lib/modelo.js)
 * Responsable: Luis Alberto Tecsi Huallpa (Gestión de Proyecto y Desarrollo)
 *
 * Se prueban las funciones puras del motor de horarios (modelo de Poisson), las franjas
 * de atención, la generación de turnos y el orden de la cola. La base de datos se
 * reemplaza por un doble de prueba en memoria (tests/apoyo/app-simulada.mjs).
 */
import { createRequire } from 'node:module';
import { expect } from 'chai';
import {
	AppSimulada,
	escenarioAgencia,
	instalarGlobalesPocketBase
} from '../apoyo/app-simulada.mjs';

const require = createRequire(import.meta.url);
const modelo = require('../../backend/pb_hooks/lib/modelo.js');

const LUNES = '2030-06-03';
const SABADO = '2030-06-08';
const DOMINGO = '2030-06-09';

/** Curva de llegadas históricas de un lunes (misma forma que la migración). */
const CURVA_LUNES = {
	'08:30': 9.2, '09:00': 13.8, '09:30': 15.0, '10:00': 12.7, '10:30': 10.4, '11:00': 9.2,
	'11:30': 8.1, '12:00': 9.2, '12:30': 10.4, '13:00': 8.1, '13:30': 6.9, '14:00': 5.8,
	'14:30': 5.8, '15:00': 6.9, '15:30': 8.1, '16:00': 6.9, '16:30': 5.8, '17:00': 3.5
};

function cargarAfluencia(app, agencia) {
	for (const [franja, promedio] of Object.entries(CURVA_LUNES)) {
		app.agregar('afluencia_historica', {
			agencia: agencia.id,
			dia_semana: 1,
			franja,
			promedio_llegadas: promedio
		});
	}
}

describe('Luis · Motor de horarios: modelo de probabilidad de Poisson', () => {
	it('P(X ≥ 0) es 1 para cualquier λ', () => {
		expect(modelo.probPoissonAlMenos(0, 0)).to.equal(1);
		expect(modelo.probPoissonAlMenos(7.5, 0)).to.equal(1);
	});

	it('con λ = 0 (nadie llega) la probabilidad de congestión es 0', () => {
		expect(modelo.probPoissonAlMenos(0, 1)).to.equal(0);
		expect(modelo.probPoissonAlMenos(0, 11)).to.equal(0);
	});

	it('coincide con el valor analítico: P(X ≥ 3 | λ = 2) = 1 − e⁻²(1 + 2 + 2)', () => {
		const esperado = 1 - Math.exp(-2) * (1 + 2 + 2);
		expect(modelo.probPoissonAlMenos(2, 3)).to.be.closeTo(esperado, 1e-12);
	});

	it('crece cuando aumentan las llegadas esperadas (λ) con la misma capacidad', () => {
		let anterior = -1;
		for (let lambda = 1; lambda <= 25; lambda++) {
			const p = modelo.probPoissonAlMenos(lambda, 11);
			expect(p).to.be.greaterThan(anterior);
			anterior = p;
		}
	});

	it('siempre devuelve un valor entre 0 y 1', () => {
		for (let lambda = 0; lambda <= 60; lambda += 3.7) {
			for (let k = 0; k <= 40; k += 4) {
				expect(modelo.probPoissonAlMenos(lambda, k)).to.be.within(0, 1);
			}
		}
	});
});

describe('Luis · Franjas de atención de la agencia', () => {
	const { agencia } = escenarioAgencia();

	it('de lunes a viernes genera 18 franjas de 30 min entre 08:30 y 17:00', () => {
		const franjas = modelo.franjasDelDia(agencia, LUNES);
		expect(franjas).to.have.lengthOf(18);
		expect(franjas[0]).to.equal('08:30');
		expect(franjas.at(-1)).to.equal('17:00');
	});

	it('el sábado solo atiende de 09:00 a 13:00', () => {
		expect(modelo.franjasDelDia(agencia, SABADO)).to.deep.equal([
			'09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'
		]);
	});

	it('el domingo no hay atención', () => {
		expect(modelo.franjasDelDia(agencia, DOMINGO)).to.be.empty;
	});
});

describe('Luis · Sugerencia de horarios (calcularHorarios)', () => {
	before(instalarGlobalesPocketBase);

	it('recomienda exactamente una franja: la disponible con menor congestión', () => {
		const { app, agencia } = escenarioAgencia();
		cargarAfluencia(app, agencia);
		const r = modelo.calcularHorarios(app, agencia.id, LUNES);

		const recomendadas = r.franjas.filter((f) => f.recomendado);
		expect(recomendadas).to.have.lengthOf(1);
		const minima = Math.min(...r.franjas.filter((f) => f.disponible).map((f) => f.probabilidad));
		expect(recomendadas[0].probabilidad).to.equal(minima);
		expect(r.sugeridas[0]).to.equal(recomendadas[0].hora);
	});

	it('clasifica la hora punta (09:30) como afluencia alta y la tarde como baja', () => {
		const { app, agencia } = escenarioAgencia();
		cargarAfluencia(app, agencia);
		const r = modelo.calcularHorarios(app, agencia.id, LUNES);
		const nivel = (h) => r.franjas.find((f) => f.hora === h).nivel;
		expect(nivel('09:30')).to.equal('alta');
		expect(nivel('17:00')).to.equal('baja');
	});

	it('bloquea una franja cuando se llena su cupo de citas', () => {
		const { app, agencia, servicios } = escenarioAgencia();
		const cupo = modelo.calcularHorarios(app, agencia.id, LUNES).franjas[0].cupos_libres;
		for (let i = 0; i < cupo; i++) {
			app.agregar('turnos', {
				agencia: agencia.id, servicio: servicios.cts.id, fecha: LUNES, hora: '08:30', estado: 'en_espera'
			});
		}
		const franja = modelo.calcularHorarios(app, agencia.id, LUNES).franjas[0];
		expect(franja.cupos_libres).to.equal(0);
		expect(franja.disponible).to.equal(false);
	});

	it('las citas canceladas no ocupan cupo', () => {
		const { app, agencia, servicios } = escenarioAgencia();
		app.agregar('turnos', {
			agencia: agencia.id, servicio: servicios.cts.id, fecha: LUNES, hora: '10:00', estado: 'cancelado'
		});
		const franja = modelo.calcularHorarios(app, agencia.id, LUNES).franjas.find((f) => f.hora === '10:00');
		expect(franja.reservadas).to.equal(0);
	});

	it('más ventanillas activas reducen la congestión estimada', () => {
		const pocas = escenarioAgencia({ ventanillas: 2 });
		const muchas = escenarioAgencia({ ventanillas: 6 });
		cargarAfluencia(pocas.app, pocas.agencia);
		cargarAfluencia(muchas.app, muchas.agencia);
		const p = (e) =>
			modelo.calcularHorarios(e.app, e.agencia.id, LUNES).franjas.find((f) => f.hora === '09:30').probabilidad;
		expect(p(muchas)).to.be.lessThan(p(pocas));
	});

	it('sin ventanillas activas no ofrece ningún horario', () => {
		const { app, agencia } = escenarioAgencia({ ventanillas: 3, inactivas: 3 });
		const r = modelo.calcularHorarios(app, agencia.id, LUNES);
		expect(r.ventanillas_activas).to.equal(0);
		expect(r.franjas.every((f) => !f.disponible)).to.equal(true);
		expect(r.sugeridas).to.be.empty;
	});

	it('rechaza una agencia que no está atendiendo', () => {
		const { app, agencia } = escenarioAgencia({ activa: false });
		expect(() => modelo.calcularHorarios(app, agencia.id, LUNES)).to.throw(
			globalThis.BadRequestError,
			'no está atendiendo'
		);
	});
});

describe('Luis · Generación de turnos y orden de la cola', () => {
	before(instalarGlobalesPocketBase);

	const datosTurno = (agencia, servicio, extra = {}) => ({
		agencia: agencia.id,
		servicio: servicio.id,
		cliente: 'cliente_1',
		canal: 'ventanilla',
		fecha: LUNES,
		hora: '10:00',
		...extra
	});

	it('numera los turnos de forma correlativa por agencia y día (C-001, C-002…)', () => {
		const { app, agencia, servicios } = escenarioAgencia();
		const t1 = modelo.crearTurno(app, datosTurno(agencia, servicios.cts));
		const t2 = modelo.crearTurno(app, datosTurno(agencia, servicios.cuenta));
		expect(t1.getString('codigo')).to.equal('C-001');
		expect(t2.getString('codigo')).to.equal('C-002');
		expect(t2.getString('estado')).to.equal('en_espera');
	});

	it('pasa de C-099 a C-100 sin perder el formato', () => {
		const { app, agencia, servicios } = escenarioAgencia();
		app.agregar('turnos', { agencia: agencia.id, fecha: LUNES, codigo: 'C-099' });
		expect(modelo.crearTurno(app, datosTurno(agencia, servicios.cts)).getString('codigo')).to.equal('C-100');
	});

	it('genera enlace de Google Meet solo para el canal plataforma', () => {
		const { app, agencia, servicios } = escenarioAgencia();
		const virtual = modelo.crearTurno(app, datosTurno(agencia, servicios.cts, { canal: 'plataforma' }));
		const presencial = modelo.crearTurno(app, datosTurno(agencia, servicios.cts));
		expect(virtual.getString('enlace_meet')).to.match(/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
		expect(presencial.getString('enlace_meet')).to.equal('');
	});

	it('ordena la cola: prioritarios primero y luego por hora de la cita', () => {
		const { app, agencia, servicios } = escenarioAgencia();
		const f = (hora, prioridad, codigo) =>
			app.agregar('turnos', {
				agencia: agencia.id, servicio: servicios.cts.id, fecha: LUNES, hora, prioridad, codigo, estado: 'en_espera', canal: 'ventanilla'
			});
		f('09:00', false, 'C-001');
		f('11:00', true, 'C-002');
		f('08:30', false, 'C-003');
		const cola = modelo.construirCola(app, agencia.id, LUNES).turnos.map((t) => t.codigo);
		expect(cola).to.deep.equal(['C-002', 'C-003', 'C-001']);
	});

	it('calcula la espera acumulada dividida entre las ventanillas activas', () => {
		const { app, agencia, servicios } = escenarioAgencia({ ventanillas: 2 });
		const horas = ['08:30', '09:00', '09:30'];
		for (const [i, s] of [servicios.cuenta, servicios.cts, servicios.reclamo].entries()) {
			app.agregar('turnos', {
				agencia: agencia.id, servicio: s.id, fecha: LUNES, hora: horas[i], prioridad: false, codigo: `C-00${i + 1}`, estado: 'en_espera', canal: 'ventanilla'
			});
		}
		const espera = modelo.construirCola(app, agencia.id, LUNES).turnos.map((t) => t.espera_min);
		// 0 · 15/2 ≈ 8 · (15+12)/2 ≈ 14
		expect(espera).to.deep.equal([0, 8, 14]);
	});

	it('la cola pública no expone datos personales del cliente', () => {
		const { app, agencia, servicios } = escenarioAgencia();
		modelo.crearTurno(app, datosTurno(agencia, servicios.cts, { observacion: 'dato sensible', monto_aprox: 3500 }));
		const [item] = modelo.construirCola(app, agencia.id, LUNES).turnos;
		expect(item).to.have.all.keys(
			'id', 'codigo', 'servicio', 'canal', 'estado', 'prioridad', 'hora', 'ventanilla', 'llamado_en', 'posicion', 'espera_min'
		);
	});

	it('el doble de prueba no deja datos entre pruebas (independencia)', () => {
		expect(new AppSimulada().findRecordsByFilter('turnos', '', '', 0, 0, {})).to.be.empty;
	});
});
