<script lang="ts">
	import { onMount } from 'svelte';
	import BarraPersonal from '$lib/components/BarraPersonal.svelte';
	import { pb } from '$lib/pocketbase';
	import { panel } from '$lib/stores/panel.svelte';
	import { sesion } from '$lib/stores/sesion.svelte';
	import type { Agencia, FilaReporte, Indicadores, Servicio, Ventanilla } from '$lib/tipos';
	import { hoyPeru, mensajeError, sumarDias } from '$lib/util';

	// Figura 2.8 — Panel de administración y reportes del responsable de agencia.
	let indicadores = $state<Indicadores | null>(null);
	let servicios = $state<Servicio[]>([]);
	let ventanillas = $state<Ventanilla[]>([]);
	let agencia = $state<Agencia | null>(null);
	let editando = $state<'' | 'tramites' | 'ventanillas'>('');
	let error = $state('');
	let aviso = $state('');
	let guardando = $state('');

	let desde = $state(sumarDias(hoyPeru(), -29));
	let hasta = $state(hoyPeru());

	async function cargar() {
		const op = sesion.operador;
		if (!op) return;
		try {
			const [ind, srv, vent, ag] = await Promise.all([
				pb.send<Indicadores>('/api/panel/indicadores', {}),
				pb.collection('servicios').getFullList<Servicio>({ sort: 'orden' }),
				pb.collection('ventanillas').getFullList<Ventanilla>({
					filter: pb.filter('agencia = {:a}', { a: op.agencia }),
					sort: 'numero'
				}),
				pb.collection('agencias').getOne<Agencia>(op.agencia)
			]);
			indicadores = ind;
			servicios = srv;
			ventanillas = vent;
			agencia = ag;
			error = '';
		} catch (err) {
			error = mensajeError(err);
		}
	}

	onMount(() => {
		cargar();
		const intervalo = setInterval(() => {
			pb.send<Indicadores>('/api/panel/indicadores', {})
				.then((i) => (indicadores = i))
				.catch(() => undefined);
		}, 20000);
		return () => clearInterval(intervalo);
	});

	async function guardar(clave: string, accion: () => Promise<unknown>, mensaje: string) {
		guardando = clave;
		aviso = '';
		error = '';
		try {
			await accion();
			aviso = mensaje;
		} catch (err) {
			error = mensajeError(err);
			await cargar();
		} finally {
			guardando = '';
		}
	}

	const guardarServicio = (s: Servicio) =>
		guardar(
			s.id,
			() =>
				pb.collection('servicios').update(s.id, { duracion_min: s.duracion_min, activo: s.activo }),
			`«${s.nombre}» actualizado.`
		);

	const guardarVentanilla = (v: Ventanilla) =>
		guardar(
			v.id,
			() => pb.collection('ventanillas').update(v.id, { activa: v.activa }),
			`Ventanilla ${v.numero} ${v.activa ? 'activada' : 'desactivada'}.`
		);

	function guardarHorario() {
		const actual = agencia;
		if (!actual) return;
		guardar(
			'horario',
			async () => {
				panel.agencia = await pb.collection('agencias').update<Agencia>(actual.id, {
					hora_apertura: actual.hora_apertura,
					hora_cierre: actual.hora_cierre
				});
			},
			'Horario de atención actualizado.'
		);
	}

	async function exportar() {
		guardando = 'reporte';
		error = '';
		aviso = '';
		try {
			const r = await pb.send<{ filas: FilaReporte[] }>('/api/panel/reporte', {
				query: { desde, hasta }
			});
			if (!r.filas.length) {
				aviso = 'No hay turnos en ese rango de fechas.';
				return;
			}
			const columnas: (keyof FilaReporte)[] = [
				'fecha',
				'franja',
				'tramite',
				'canal',
				'total',
				'atendidos',
				'cancelados',
				'no_asistio',
				'prioritarios'
			];
			const escapar = (v: unknown) => `"${String(v).replaceAll('"', '""')}"`;
			const csv = [
				columnas.join(','),
				...r.filas.map((f) => columnas.map((c) => escapar(f[c])).join(','))
			].join('\r\n');
			const url = URL.createObjectURL(
				new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
			);
			const a = document.createElement('a');
			a.href = url;
			a.download = `afluencia_${desde}_${hasta}.csv`;
			a.click();
			URL.revokeObjectURL(url);
			aviso = `Reporte descargado (${r.filas.length} filas).`;
		} catch (err) {
			error = mensajeError(err);
		} finally {
			guardando = '';
		}
	}

	async function demo() {
		guardando = 'demo';
		aviso = '';
		error = '';
		try {
			const r = await pb.send<{ creados: string[] }>('/api/panel/demo', { method: 'POST' });
			await cargar();
			aviso = `Turnos de demostración creados: ${r.creados.join(', ')}.`;
		} catch (err) {
			error = mensajeError(err);
		} finally {
			guardando = '';
		}
	}
</script>

<svelte:head>
	<title>Administración · Panel interno</title>
</svelte:head>

<BarraPersonal titulo="Administración" />

<main class="mx-auto max-w-5xl px-5 py-8">
	{#if error}<p class="error-caja mb-5" role="alert">{error}</p>{/if}
	{#if aviso}<p class="nota mb-5" role="status">{aviso}</p>{/if}

	<section aria-labelledby="t-ind">
		<h1 id="t-ind" class="text-xl font-bold">Indicadores del día</h1>
		<div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
			{#each [{ n: 'Atendidos', v: indicadores?.atendidos }, { n: 'Prom. espera', v: indicadores ? `${indicadores.prom_espera_min} min` : undefined }, { n: 'Cancelados', v: indicadores?.cancelados }, { n: 'En espera', v: indicadores?.en_espera }] as k (k.n)}
				<div class="panel p-4 text-center">
					<p class="text-sm text-surface-800">{k.n}</p>
					<p class="codigo mt-1 text-3xl font-bold">{k.v ?? '…'}</p>
				</div>
			{/each}
		</div>
		{#if indicadores}
			<p class="mt-2 text-sm text-surface-700">
				No asistieron: {indicadores.no_asistio} · Duración promedio de atención: {indicadores.prom_atencion_min}
				min
			</p>
		{/if}
	</section>

	<section class="mt-10" aria-labelledby="t-cat">
		<h2 id="t-cat" class="text-xl font-bold">Gestión del catálogo</h2>
		<div class="panel mt-4 overflow-x-auto">
			<table class="tabla">
				<thead><tr><th>Elemento</th><th class="w-32">Acción</th></tr></thead>
				<tbody>
					<tr>
						<td>Trámites y horarios</td>
						<td>
							<button
								type="button"
								class="font-bold underline"
								aria-expanded={editando === 'tramites'}
								onclick={() => (editando = editando === 'tramites' ? '' : 'tramites')}
							>
								{editando === 'tramites' ? 'Cerrar' : 'Editar'}
							</button>
						</td>
					</tr>
					{#if editando === 'tramites'}
						<tr>
							<td colspan="2" class="bg-surface-50">
								{#if agencia}
									<div class="flex flex-wrap items-end gap-4 py-2">
										<label
											><span class="etiqueta">Apertura</span><input
												type="time"
												class="campo"
												bind:value={agencia.hora_apertura}
											/></label
										>
										<label
											><span class="etiqueta">Cierre</span><input
												type="time"
												class="campo"
												bind:value={agencia.hora_cierre}
											/></label
										>
										<button
											type="button"
											class="btn-principal"
											disabled={guardando === 'horario'}
											onclick={guardarHorario}>Guardar horario</button
										>
									</div>
								{/if}
								<table class="tabla mt-4">
									<thead
										><tr><th>Trámite</th><th>Duración (min)</th><th>Disponible</th><th></th></tr
										></thead
									>
									<tbody>
										{#each servicios as s (s.id)}
											<tr>
												<td>{s.nombre}</td>
												<td
													><input
														type="number"
														min="1"
														max="120"
														class="campo w-24"
														bind:value={s.duracion_min}
														aria-label="Duración de {s.nombre}"
													/></td
												>
												<td
													><input
														type="checkbox"
														class="checkbox size-5"
														bind:checked={s.activo}
														aria-label="{s.nombre} disponible"
													/></td
												>
												<td
													><button
														type="button"
														class="font-bold underline"
														disabled={guardando === s.id}
														onclick={() => guardarServicio(s)}>Guardar</button
													></td
												>
											</tr>
										{/each}
									</tbody>
								</table>
							</td>
						</tr>
					{/if}
					<tr>
						<td>Ventanillas activas</td>
						<td>
							<button
								type="button"
								class="font-bold underline"
								aria-expanded={editando === 'ventanillas'}
								onclick={() => (editando = editando === 'ventanillas' ? '' : 'ventanillas')}
							>
								{editando === 'ventanillas' ? 'Cerrar' : 'Editar'}
							</button>
						</td>
					</tr>
					{#if editando === 'ventanillas'}
						<tr>
							<td colspan="2" class="bg-surface-50">
								<ul class="flex flex-wrap gap-3 py-2">
									{#each ventanillas as v (v.id)}
										<li>
											<label class="panel flex items-center gap-3 px-4 py-3">
												<input
													type="checkbox"
													class="checkbox size-5"
													bind:checked={v.activa}
													disabled={guardando === v.id}
													onchange={() => guardarVentanilla(v)}
												/>
												<span class="codigo font-bold"
													>Ventanilla {String(v.numero).padStart(2, '0')}</span
												>
											</label>
										</li>
									{/each}
								</ul>
								<p class="text-sm text-surface-700">
									El modelo de horarios usa las ventanillas activas para calcular la capacidad.
								</p>
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</section>

	<section class="mt-10" aria-labelledby="t-rep">
		<h2 id="t-rep" class="text-xl font-bold">Reportes</h2>
		<p class="mt-1 text-sm text-surface-800">
			Afluencia por fecha, franja, trámite y canal, para ajustar el modelo de horarios.
		</p>
		<div class="mt-4 flex flex-wrap items-end gap-4">
			<label
				><span class="etiqueta">Desde</span><input
					type="date"
					class="campo"
					bind:value={desde}
					max={hasta}
				/></label
			>
			<label
				><span class="etiqueta">Hasta</span><input
					type="date"
					class="campo"
					bind:value={hasta}
					min={desde}
				/></label
			>
			<button
				type="button"
				class="btn-secundario"
				disabled={guardando === 'reporte'}
				onclick={exportar}
			>
				📊 {guardando === 'reporte' ? 'Generando…' : 'Exportar reporte de afluencia'}
			</button>
		</div>
	</section>

	<section class="mt-12 border-t border-surface-300 pt-6">
		<h2 class="font-bold">Datos de demostración</h2>
		<p class="mt-1 text-sm text-surface-800">
			Crea 6 turnos de hoy con clientes del padrón simulado, para presentar el flujo completo.
		</p>
		<button type="button" class="btn-secundario mt-3" disabled={guardando === 'demo'} onclick={demo}
			>Generar turnos de prueba</button
		>
	</section>
</main>
