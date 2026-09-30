/**
 * Levanta un PocketBase TEMPORAL para las pruebas de integración.
 *
 * - Usa los mismos pb_migrations y pb_hooks del proyecto, así que prueba el backend real.
 * - Crea la base de datos en una carpeta temporal del sistema y la borra al terminar:
 *   las pruebas nunca tocan backend/pb_data (no alteran el estado del sistema).
 * - Cada archivo de pruebas levanta su propio servidor en un puerto libre, de modo que
 *   las pruebas son independientes y repetibles.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import PocketBase from 'pocketbase';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BACKEND = join(RAIZ, 'backend');
const BINARIO = join(BACKEND, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');

export const SUPERUSUARIO = { email: 'admin@colasbn.local', clave: 'AdminColasBN2026' };
export const CLAVE_PERSONAL = 'Colas2026!';

function puertoLibre() {
	return new Promise((ok, falla) => {
		const s = createServer();
		s.unref();
		s.on('error', falla);
		s.listen(0, '127.0.0.1', () => {
			const { port } = s.address();
			s.close(() => ok(port));
		});
	});
}

async function esperarSalud(url, intentos = 100) {
	for (let i = 0; i < intentos; i++) {
		try {
			const r = await fetch(`${url}/api/health`);
			if (r.ok) return;
		} catch {
			// todavía arrancando
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	throw new Error(`PocketBase no respondió en ${url}`);
}

/** @returns {Promise<{url: string, detener: () => Promise<void>, cliente: () => PocketBase}>} */
export async function levantarServidor() {
	if (!existsSync(BINARIO)) {
		throw new Error(
			`No se encontró ${BINARIO}. Descarga PocketBase 0.40.4 y colócalo en backend/ (ver README).`
		);
	}
	const datos = mkdtempSync(join(tmpdir(), 'colasbn-pruebas-'));
	const puerto = await puertoLibre();
	const url = `http://127.0.0.1:${puerto}`;
	const proceso = spawn(
		BINARIO,
		[
			'serve',
			`--http=127.0.0.1:${puerto}`,
			`--dir=${datos}`,
			`--migrationsDir=${join(BACKEND, 'pb_migrations')}`,
			`--hooksDir=${join(BACKEND, 'pb_hooks')}`,
			'--hooksWatch=false',
			`--publicDir=${join(datos, 'public')}`
		],
		{ stdio: ['ignore', 'ignore', 'pipe'] }
	);
	let errores = '';
	proceso.stderr.on('data', (d) => (errores += d));
	proceso.on('exit', (codigo) => {
		if (codigo) errores += `\n(PocketBase terminó con código ${codigo})`;
	});

	try {
		await esperarSalud(url);
	} catch (e) {
		proceso.kill();
		throw new Error(`${e.message}\n${errores}`);
	}

	return {
		url,
		cliente: () => {
			const pb = new PocketBase(url);
			pb.autoCancellation(false);
			return pb;
		},
		detener: async () => {
			if (proceso.exitCode === null) {
				await new Promise((ok) => {
					proceso.once('exit', ok);
					proceso.kill();
				});
			}
			rmSync(datos, { recursive: true, force: true });
		}
	};
}

/** Fecha y hora de Perú (UTC-5), igual que en pb_hooks/lib/modelo.js. */
export function hoyPeru() {
	return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function sumarDias(fecha, dias) {
	const d = new Date(`${fecha}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + dias);
	return d.toISOString().slice(0, 10);
}

/** Próximo día hábil (lunes a sábado) a partir de mañana: siempre tiene franjas futuras. */
export function proximoDiaHabil() {
	let f = sumarDias(hoyPeru(), 1);
	while (new Date(`${f}T12:00:00Z`).getUTCDay() === 0) f = sumarDias(f, 1);
	return f;
}
