/**
 * PRUEBAS DE INTEGRACIÓN — Flujos funcionales y casos de prueba de la matriz (Guía 03)
 * Responsable: Nelson Paucara Huillca (Análisis Funcional y QA)
 *
 * Recorren la API real de PocketBase (pb_hooks + migraciones) sobre un servidor temporal:
 * identificación, sugerencia de horarios, generación del ticket, cancelación y atención en
 * ventanilla. Los IDs CP-xx corresponden a la matriz de casos de prueba de la Guía 03.
 * El servidor se crea y se destruye en cada ejecución: no altera la base de datos real.
 */
import { expect } from 'chai';
import { hoyPeru, levantarServidor, proximoDiaHabil, sumarDias } from '../apoyo/servidor.mjs';
import { catalogos, comoCliente, comoPersonal, esperarError, sembrarTurnoDeHoy } from '../apoyo/datos.mjs';

describe('Nelson · Identificación del cliente', () => {
	let servidor;
	before(async () => (servidor = await levantarServidor()));
	after(async () => servidor?.detener());

	it('CP-01 · un DNI válido del padrón obtiene acceso y queda verificado', async () => {
		const pb = await comoCliente(servidor, '71234231');
		expect(pb.authStore.isValid).to.equal(true);
		expect(pb.authStore.record).to.include({
			nombres: 'Juan Pérez Rojas',
			verificado_legado: true,
			numero_documento: '71234231'
		});
	});

	it('CP-02 · un DNI de 7 dígitos se rechaza con un mensaje claro', async () => {
		const e = await esperarError(comoCliente(servidor, '1234567'));
		expect(e.status).to.equal(400);
		expect(e.response.message).to.equal('El DNI debe tener exactamente 8 dígitos.');
	});

	it('un documento válido que no está en el padrón ingresa como no verificado', async () => {
		const pb = await comoCliente(servidor, '48291730');
		expect(pb.authStore.record.verificado_legado).to.equal(false);
	});

	it('identificarse dos veces no duplica al cliente', async () => {
		const a = await comoCliente(servidor, 'AB123456', 'PASAPORTE');
		const b = await comoCliente(servidor, 'ab123456', 'PASAPORTE');
		expect(a.authStore.record.id).to.equal(b.authStore.record.id);
	});
});

describe('Nelson · Solicitud de cita y ticket', () => {
	let servidor;
	let cat;
	let pb;
	const fecha = proximoDiaHabil();

	before(async () => {
		servidor = await levantarServidor();
		cat = await catalogos(servidor);
		pb = await comoCliente(servidor, '72981134');
	});
	after(async () => servidor?.detener());

	const reservar = (cliente, extra) =>
		cliente.send('/api/citas/turno', {
			method: 'POST',
			body: { agencia: cat.cusco.id, servicio: cat.cts.id, canal: 'ventanilla', fecha, hora: '15:00', ...extra }
		});

	it('CP-15 · los horarios sugeridos traen una sola recomendación, disponible', async () => {
		const r = await pb.send('/api/citas/horarios', { query: { agencia: cat.cusco.id, fecha } });
		expect(r.franjas).to.not.be.empty;
		const recomendadas = r.franjas.filter((f) => f.recomendado);
		expect(recomendadas).to.have.lengthOf(1);
		expect(recomendadas[0].disponible).to.equal(true);
		expect(r.sugeridas.length).to.be.within(1, 3);
	});

	it('no permite reservar con más de 14 días de anticipación', async () => {
		const e = await esperarError(
			pb.send('/api/citas/horarios', { query: { agencia: cat.cusco.id, fecha: sumarDias(hoyPeru(), 15) } })
		);
		expect(e.status).to.equal(400);
		expect(e.response.message).to.contain('14 días');
	});

	it('CP-07 · genera el ticket C-001 y descuenta un cupo de la franja', async () => {
		const antes = await pb.send('/api/citas/horarios', { query: { agencia: cat.cusco.id, fecha } });
		const r = await reservar(pb, { monto_aprox: 3500, observacion: 'Primera solicitud' });
		expect(r.codigo).to.equal('C-001');

		const turno = await pb.collection('turnos').getOne(r.id);
		expect(turno).to.include({ estado: 'en_espera', hora: '15:00', monto_aprox: 3500, enlace_meet: '' });

		const despues = await pb.send('/api/citas/horarios', { query: { agencia: cat.cusco.id, fecha } });
		const cupo = (x) => x.franjas.find((f) => f.hora === '15:00').cupos_libres;
		expect(cupo(despues)).to.equal(cupo(antes) - 1);
	});

	it('la atención por plataforma incluye enlace de Google Meet', async () => {
		const r = await reservar(pb, { servicio: cat.cuenta.id, canal: 'plataforma', hora: '15:30' });
		const turno = await pb.collection('turnos').getOne(r.id);
		expect(turno.enlace_meet).to.match(/^https:\/\/meet\.google\.com\//);
	});

	it('no permite dos citas activas del mismo trámite el mismo día', async () => {
		const e = await esperarError(reservar(pb, { hora: '16:00' }));
		expect(e.status).to.equal(400);
		expect(e.response.message).to.contain('Ya tienes una cita activa').and.contain('C-001');
	});

	it('rechaza una hora fuera del horario de la agencia', async () => {
		const e = await esperarError(reservar(pb, { servicio: cat.reclamo.id, hora: '03:00' }));
		expect(e.status).to.equal(400);
	});

	it('exige indicar el motivo cuando se pide atención prioritaria', async () => {
		const e = await esperarError(reservar(pb, { servicio: cat.pension.id, prioridad: true }));
		expect(e.response.message).to.contain('prioritaria');
	});

	it('permite cancelar una cita en espera, una sola vez', async () => {
		const r = await reservar(pb, { servicio: cat.reclamo.id, hora: '16:30' });
		const ok = await pb.send(`/api/citas/turno/${r.id}/cancelar`, { method: 'POST' });
		expect(ok.estado).to.equal('cancelado');
		const e = await esperarError(pb.send(`/api/citas/turno/${r.id}/cancelar`, { method: 'POST' }));
		expect(e.status).to.equal(400);
	});
});

describe('Nelson · Atención en ventanilla', () => {
	let servidor;
	let cat;
	let operador;
	let normal;
	let prioritario;

	before(async () => {
		servidor = await levantarServidor();
		cat = await catalogos(servidor);
		const cliente = (await comoCliente(servidor, '45120087')).authStore.record.id;
		normal = await sembrarTurnoDeHoy(servidor, { agencia: cat.cusco.id, servicio: cat.cts.id, cliente, hora: '08:30' });
		prioritario = await sembrarTurnoDeHoy(servidor, {
			agencia: cat.cusco.id, servicio: cat.pension.id, cliente, hora: '10:00', prioridad: true, tipo_prioridad: 'adulto_mayor'
		});
		operador = await comoPersonal(servidor, 'operador1');
	});
	after(async () => servidor?.detener());

	it('el operador ingresa con su usuario institucional', () => {
		expect(operador.authStore.record).to.include({ usuario: 'operador1', rol: 'operador' });
	});

	it('«Llamar siguiente turno» atiende primero al prioritario aunque su cita sea más tarde', async () => {
		const r = await operador.send('/api/panel/llamar', { method: 'POST', body: {} });
		expect(r.id).to.equal(prioritario.id);
		expect(r.retomado).to.equal(false);
	});

	it('si ya tiene una atención abierta, la retoma en vez de llamar a otro', async () => {
		const r = await operador.send('/api/panel/llamar', { method: 'POST', body: {} });
		expect(r).to.include({ id: prioritario.id, retomado: true });
	});

	it('la pantalla de llamados muestra el turno con su ventanilla', async () => {
		const cola = await servidor.cliente().send(`/api/citas/cola/${cat.cusco.id}`, {});
		const llamado = cola.turnos.find((t) => t.id === prioritario.id);
		expect(llamado).to.include({ estado: 'atendiendo', ventanilla: 3 });
	});

	it('CP-30 · la ficha muestra el contexto y la verificación con el sistema legado', async () => {
		const ficha = await operador.collection('turnos').getOne(prioritario.id, { expand: 'cliente,servicio' });
		expect(ficha.expand.cliente).to.include({ nombres: 'Rosa Quispe Mamani', verificado_legado: true });
		expect(ficha.expand.servicio.nombre).to.equal('Cobro de pensión');
	});

	it('al finalizar, el turno queda atendido y cuenta en los indicadores', async () => {
		await operador.send(`/api/panel/turno/${prioritario.id}/finalizar`, { method: 'POST', body: {} });
		const ind = await operador.send('/api/panel/indicadores', {});
		expect(ind).to.include({ atendidos: 1, en_espera: 1, atendiendo: 0 });
	});

	it('«No se presentó» cierra el turno sin contarlo como atendido', async () => {
		const r = await operador.send('/api/panel/llamar', { method: 'POST', body: {} });
		expect(r.id).to.equal(normal.id);
		await operador.send(`/api/panel/turno/${normal.id}/finalizar`, { method: 'POST', body: { resultado: 'no_asistio' } });
		const ind = await operador.send('/api/panel/indicadores', {});
		expect(ind).to.include({ atendidos: 1, no_asistio: 1, en_espera: 0 });
	});

	it('con la cola vacía avisa que no hay turnos en espera', async () => {
		const e = await esperarError(operador.send('/api/panel/llamar', { method: 'POST', body: {} }));
		expect(e.response.message).to.contain('No hay turnos en espera');
	});

	it('el responsable de agencia exporta la afluencia del día', async () => {
		const admin = await comoPersonal(servidor, 'admin.cusco');
		const r = await admin.send('/api/panel/reporte', { query: { desde: hoyPeru(), hasta: hoyPeru() } });
		const total = r.filas.reduce((s, f) => s + f.total, 0);
		expect(total).to.equal(2);
		expect(r.filas[0]).to.have.all.keys(
			'fecha', 'franja', 'tramite', 'canal', 'total', 'atendidos', 'cancelados', 'no_asistio', 'prioritarios'
		);
	});
});
