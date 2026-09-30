/**
 * Doble de prueba (mock) de la API de PocketBase que usa backend/pb_hooks/lib/modelo.js.
 *
 * Permite probar la lógica de negocio en milisegundos, sin levantar el servidor ni tocar
 * una base de datos: cada prueba arma su propio escenario en memoria.
 */

let secuencia = 0;

/** Registro en memoria con la misma interfaz que core.Record de PocketBase. */
export class RegistroSimulado {
	constructor(coleccion, datos = {}) {
		this.coleccion = coleccion;
		this.datos = { ...datos };
		if (!this.datos.created) this.datos.created = `2026-01-01 00:00:${String(secuencia++).padStart(6, '0')}Z`;
	}
	get id() {
		return this.datos.id;
	}
	set(campo, valor) {
		this.datos[campo] = valor;
	}
	get(campo) {
		return this.datos[campo];
	}
	getString(campo) {
		const v = this.datos[campo];
		return v === undefined || v === null ? '' : String(v);
	}
	getInt(campo) {
		return Math.trunc(Number(this.datos[campo] ?? 0));
	}
	getFloat(campo) {
		return Number(this.datos[campo] ?? 0);
	}
	getBool(campo) {
		return this.datos[campo] === true;
	}
}

/** Convierte un filtro de PocketBase (subconjunto usado en modelo.js) en una función JS. */
function compilarFiltro(filtro, parametros = {}) {
	if (!filtro) return () => true;
	let js = filtro.replace(/\{:(\w+)\}/g, (_, k) => JSON.stringify(parametros[k] ?? ''));
	js = js.replace(/!=/g, '!==').replace(/(?<![!<>=])=(?!=)/g, '===');
	js = js.replace(/\b([a-z_][a-z0-9_]*)\b(?=\s*(===|!==|>=|<=|>|<))/g, 'r.$1');
	// eslint-disable-next-line no-new-func
	return new Function('r', `return ${js};`);
}

function ordenar(lista, orden) {
	if (!orden) return lista;
	const campos = orden.split(',').map((c) => ({
		desc: c.startsWith('-'),
		campo: c.replace(/^[-+]/, '')
	}));
	return [...lista].sort((a, b) => {
		for (const { campo, desc } of campos) {
			const x = a.datos[campo];
			const y = b.datos[campo];
			if (x === y) continue;
			const cmp = x > y ? 1 : -1;
			return desc ? -cmp : cmp;
		}
		return 0;
	});
}

/** App simulada: guarda registros por colección y responde a las consultas de modelo.js. */
export class AppSimulada {
	constructor() {
		this.tablas = {};
		this.guardados = 0;
	}

	agregar(coleccion, datos) {
		const r = new RegistroSimulado(coleccion, { id: `${coleccion}_${++secuencia}`, ...datos });
		(this.tablas[coleccion] ??= []).push(r);
		return r;
	}

	findCollectionByNameOrId(nombre) {
		return { name: nombre };
	}

	findRecordById(coleccion, id) {
		const r = (this.tablas[coleccion] ?? []).find((x) => x.id === id);
		if (!r) throw new Error('sql: no rows in result set');
		return r;
	}

	findRecordsByFilter(coleccion, filtro, orden, limite, _offset, parametros) {
		const cumple = compilarFiltro(filtro, parametros);
		const lista = ordenar(
			(this.tablas[coleccion] ?? []).filter((r) => cumple(r.datos)),
			orden
		);
		return limite > 0 ? lista.slice(0, limite) : lista;
	}

	save(registro) {
		this.guardados++;
		if (!registro.id) registro.set('id', `${registro.coleccion}_${++secuencia}`);
		const tabla = (this.tablas[registro.coleccion] ??= []);
		if (!tabla.includes(registro)) tabla.push(registro);
	}
}

/** Globales que PocketBase inyecta en el JSVM y que modelo.js necesita. */
export function instalarGlobalesPocketBase() {
	globalThis.BadRequestError = class BadRequestError extends Error {
		constructor(mensaje) {
			super(mensaje);
			this.status = 400;
		}
	};
	globalThis.Record = class extends RegistroSimulado {
		constructor(coleccion) {
			super(coleccion.name);
		}
	};
	globalThis.$security = {
		randomStringWithAlphabet(n, alfabeto) {
			let s = '';
			for (let i = 0; i < n; i++) s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
			return s;
		}
	};
}

/** Escenario base: una agencia L-V 08:30–17:30 con ventanillas y trámites. */
export function escenarioAgencia({ ventanillas = 4, inactivas = 0, activa = true } = {}) {
	const app = new AppSimulada();
	const agencia = app.agregar('agencias', {
		nombre: 'Agencia Cusco Centro',
		hora_apertura: '08:30',
		hora_cierre: '17:30',
		activa
	});
	for (let n = 1; n <= ventanillas; n++) {
		app.agregar('ventanillas', { agencia: agencia.id, numero: n, activa: n > inactivas });
	}
	const servicios = {
		cts: app.agregar('servicios', { nombre: 'Retiro de CTS', duracion_min: 12, activo: true }),
		cuenta: app.agregar('servicios', { nombre: 'Apertura de cuenta', duracion_min: 15, activo: true }),
		pension: app.agregar('servicios', { nombre: 'Cobro de pensión', duracion_min: 6, activo: true }),
		reclamo: app.agregar('servicios', { nombre: 'Reclamo', duracion_min: 10, activo: true }),
		otro: app.agregar('servicios', { nombre: 'Otro trámite', duracion_min: 8, activo: true })
	};
	return { app, agencia, servicios };
}
