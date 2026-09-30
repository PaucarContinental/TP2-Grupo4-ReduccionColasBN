/**
 * PRUEBAS DE SEGURIDAD — Validación de entradas y reglas de acceso
 * Responsable: Salome Celeste Ccahua Huamani (Infraestructura y Seguridad)
 *
 * Parte 1 (unitaria): validación de documentos y fechas en pb_hooks/lib/modelo.js.
 * Parte 2 (integración): reglas de acceso de PocketBase sobre un servidor temporal.
 * Verifican los controles pedidos por la SBS: cada actor ve solo lo que le corresponde
 * y ningún dato personal queda expuesto en canales públicos.
 */
import { createRequire } from 'node:module';
import { expect } from 'chai';
import { levantarServidor, proximoDiaHabil } from '../apoyo/servidor.mjs';
import {
	catalogos,
	comoCliente,
	comoPersonal,
	esperarError,
	sembrarTurnoDeHoy
} from '../apoyo/datos.mjs';

const require = createRequire(import.meta.url);
const modelo = require('../../backend/pb_hooks/lib/modelo.js');

describe('Salome · Validación de entradas (unitaria)', () => {
	it('acepta un DNI de 8 dígitos', () => {
		expect(modelo.validarDocumento('DNI', '71234231')).to.equal('');
	});

	it('rechaza un DNI con letras, con 7 dígitos o con dígitos repetidos', () => {
		expect(modelo.validarDocumento('DNI', '7123A231')).to.contain('8 dígitos');
		expect(modelo.validarDocumento('DNI', '1234567')).to.contain('8 dígitos');
		expect(modelo.validarDocumento('DNI', '11111111')).to.equal('El número de documento no es válido.');
	});

	it('valida carné de extranjería, PTP y pasaporte con sus propias reglas', () => {
		expect(modelo.validarDocumento('CE', '001234567')).to.equal('');
		expect(modelo.validarDocumento('PTP', '12345678')).to.contain('9 dígitos');
		expect(modelo.validarDocumento('PASAPORTE', 'AB123456')).to.equal('');
		expect(modelo.validarDocumento('PASAPORTE', 'AB-12')).to.contain('entre 6 y 12');
	});

	it('rechaza un tipo de documento desconocido', () => {
		expect(modelo.validarDocumento('RUC', '20123456789')).to.equal('Selecciona un tipo de documento válido.');
	});

	it('normaliza el documento: quita espacios y pasa a mayúsculas', () => {
		expect(modelo.normalizarDocumento(' ab 123 456 ')).to.equal('AB123456');
		expect(modelo.normalizarDocumento(undefined)).to.equal('');
	});

	it('rechaza fechas imposibles o mal formadas', () => {
		expect(modelo.fechaValida('2026-02-28')).to.equal(true);
		expect(modelo.fechaValida('2026-02-30')).to.equal(false);
		expect(modelo.fechaValida('2026/02/28')).to.equal(false);
		expect(modelo.fechaValida("2026-02-28' OR '1'='1")).to.equal(false);
	});
});

describe('Salome · Reglas de acceso (integración)', () => {
	let servidor;
	let cat;
	let juan; // cliente A
	let rosa; // cliente B
	let turnoDeJuan;

	before(async () => {
		servidor = await levantarServidor();
		cat = await catalogos(servidor);
		juan = await comoCliente(servidor, '71234231');
		rosa = await comoCliente(servidor, '45120087');
		const r = await juan.send('/api/citas/turno', {
			method: 'POST',
			body: {
				agencia: cat.cusco.id,
				servicio: cat.cts.id,
				canal: 'ventanilla',
				fecha: proximoDiaHabil(),
				hora: '15:00',
				monto_aprox: 3500,
				observacion: 'dato reservado'
			}
		});
		turnoDeJuan = r.id;
	});

	after(async () => servidor?.detener());

	it('la API de horarios exige identificarse (401 sin token)', async () => {
		const e = await esperarError(
			servidor.cliente().send('/api/citas/horarios', { query: { agencia: cat.cusco.id } })
		);
		expect(e.status).to.equal(401);
	});

	it('un cliente no puede crear turnos saltándose las validaciones del negocio', async () => {
		const e = await esperarError(
			juan.collection('turnos').create({
				codigo: 'C-777', agencia: cat.cusco.id, servicio: cat.cts.id, cliente: juan.authStore.record.id,
				canal: 'ventanilla', fecha: proximoDiaHabil(), hora: '09:30', estado: 'atendido'
			})
		);
		expect(e.status).to.equal(403);
	});

	it('cada cliente ve solo sus propios turnos', async () => {
		const deRosa = await rosa.collection('turnos').getList(1, 50);
		expect(deRosa.totalItems).to.equal(0);
		const e = await esperarError(rosa.collection('turnos').getOne(turnoDeJuan));
		expect(e.status).to.equal(404);
		const deJuan = await juan.collection('turnos').getList(1, 50);
		expect(deJuan.items.map((t) => t.id)).to.include(turnoDeJuan);
	});

	it('un cliente no puede cancelar el turno de otra persona', async () => {
		const e = await esperarError(
			rosa.send(`/api/citas/turno/${turnoDeJuan}/cancelar`, { method: 'POST' })
		);
		expect(e.status).to.equal(403);
	});

	it('un cliente no puede ver los datos de otros clientes', async () => {
		const lista = await rosa.collection('clientes').getList(1, 50);
		expect(lista.items).to.have.lengthOf(1);
		expect(lista.items[0].numero_documento).to.equal('45120087');
	});

	it('el padrón legado (Mainframe/AS400) no es accesible desde fuera', async () => {
		const anonimo = await esperarError(servidor.cliente().collection('padron_legado').getList(1, 1));
		const conToken = await esperarError(juan.collection('padron_legado').getList(1, 1));
		expect(anonimo.status).to.equal(403);
		expect(conToken.status).to.equal(403);
	});

	it('la cola pública no muestra documento, nombre, monto ni observación', async () => {
		const cliente = juan.authStore.record.id;
		await sembrarTurnoDeHoy(servidor, { agencia: cat.cusco.id, servicio: cat.cts.id, cliente, monto_aprox: 3500, observacion: 'dato reservado' });
		const cola = await servidor.cliente().send(`/api/citas/cola/${cat.cusco.id}`, {});
		const texto = JSON.stringify(cola);
		expect(cola.turnos).to.not.be.empty;
		for (const sensible of ['71234231', 'Juan', '3500', 'dato reservado', cliente]) {
			expect(texto).to.not.contain(sensible);
		}
	});

	it('una contraseña incorrecta del personal no revela si el usuario existe', async () => {
		const existe = await esperarError(servidor.cliente().collection('users').authWithPassword('operador1', 'mala'));
		const noExiste = await esperarError(servidor.cliente().collection('users').authWithPassword('fantasma', 'mala'));
		expect(existe.status).to.equal(400);
		expect(noExiste.status).to.equal(400);
		expect(existe.response.message).to.equal(noExiste.response.message);
	});

	it('el token de un cliente no abre el panel interno', async () => {
		const e = await esperarError(juan.send('/api/panel/llamar', { method: 'POST', body: {} }));
		expect(e.status).to.be.oneOf([401, 403]);
	});

	it('un operador no puede exportar reportes ni cambiar el catálogo (solo el admin)', async () => {
		const op = await comoPersonal(servidor, 'operador1');
		const reporte = await esperarError(op.send('/api/panel/reporte', {}));
		expect(reporte.status).to.equal(403);
		const edicion = await esperarError(op.collection('servicios').update(cat.cts.id, { duracion_min: 1 }));
		expect(edicion.status).to.be.oneOf([403, 404]);
	});

	it('un operador de otra agencia no puede cerrar turnos de Cusco', async () => {
		const cliente = juan.authStore.record.id;
		await sembrarTurnoDeHoy(servidor, { agencia: cat.cusco.id, servicio: cat.reclamo.id, cliente, prioridad: true, tipo_prioridad: 'adulto_mayor' });
		const cusco = await comoPersonal(servidor, 'operador1');
		const { id } = await cusco.send('/api/panel/llamar', { method: 'POST', body: {} });
		const arequipa = await comoPersonal(servidor, 'operador.arequipa');
		const e = await esperarError(
			arequipa.send(`/api/panel/turno/${id}/finalizar`, { method: 'POST', body: {} })
		);
		expect(e.status).to.equal(403);
	});
});
