/**
 * Ayudas para preparar datos en las pruebas de integración.
 * Todas trabajan sobre el servidor TEMPORAL creado por levantarServidor().
 */
import { CLAVE_PERSONAL, SUPERUSUARIO, hoyPeru } from './servidor.mjs';

/** Cliente de PocketBase autenticado como superusuario (solo para preparar datos). */
export async function comoSuperusuario(servidor) {
	const pb = servidor.cliente();
	await pb.collection('_superusers').authWithPassword(SUPERUSUARIO.email, SUPERUSUARIO.clave);
	return pb;
}

/** Cliente del banco identificado con su documento (flujo real de /api/citas/identificar). */
export async function comoCliente(servidor, numero, tipo = 'DNI') {
	const pb = servidor.cliente();
	const r = await pb.send('/api/citas/identificar', {
		method: 'POST',
		body: { tipo_documento: tipo, numero_documento: numero }
	});
	pb.authStore.save(r.token, r.record);
	return pb;
}

/** Personal de agencia autenticado con usuario y contraseña. */
export async function comoPersonal(servidor, usuario) {
	const pb = servidor.cliente();
	await pb.collection('users').authWithPassword(usuario, CLAVE_PERSONAL);
	return pb;
}

/** Catálogos cargados por la migración de datos iniciales. */
export async function catalogos(servidor) {
	const pb = servidor.cliente();
	const agencias = await pb.collection('agencias').getFullList({ sort: 'nombre' });
	const servicios = await pb.collection('servicios').getFullList({ sort: 'orden' });
	const porNombre = (lista, texto) => lista.find((x) => x.nombre.includes(texto));
	return {
		cusco: porNombre(agencias, 'Cusco'),
		arequipa: porNombre(agencias, 'Arequipa'),
		cts: porNombre(servicios, 'CTS'),
		cuenta: porNombre(servicios, 'Apertura'),
		pension: porNombre(servicios, 'pensión'),
		reclamo: porNombre(servicios, 'Reclamo')
	};
}

let correlativo = 900;

/**
 * Inserta un turno de HOY directamente (como superusuario) para probar el panel a
 * cualquier hora del día, incluso fuera del horario de atención.
 */
export async function sembrarTurnoDeHoy(servidor, { agencia, servicio, cliente, ...extra }) {
	const su = await comoSuperusuario(servidor);
	return su.collection('turnos').create({
		codigo: `C-${++correlativo}`,
		agencia,
		servicio,
		cliente,
		canal: 'ventanilla',
		prioridad: false,
		fecha: hoyPeru(),
		hora: '09:00',
		estado: 'en_espera',
		...extra
	});
}

/** Ejecuta una promesa que DEBE fallar y devuelve el error para inspeccionarlo. */
export async function esperarError(promesa) {
	try {
		await promesa;
	} catch (e) {
		return e;
	}
	throw new Error('Se esperaba un error, pero la operación se completó.');
}
