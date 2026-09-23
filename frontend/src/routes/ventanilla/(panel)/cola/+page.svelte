<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import BarraPersonal from '$lib/components/BarraPersonal.svelte';
	import { pb } from '$lib/pocketbase';
	import { sesion } from '$lib/stores/sesion.svelte';
	import type { Canal, ItemCola, RespuestaCola, Turno } from '$lib/tipos';
	import { NOMBRE_CANAL, hora12, mensajeError } from '$lib/util';

	// Figura 2.6 — Cola de turnos por agencia, priorizada automáticamente.
	type Filtro = Canal | 'todos';
	const FILTROS: { id: Filtro; nombre: string }[] = [
		{ id: 'ventanilla', nombre: 'Presencial' },
		{ id: 'plataforma', nombre: 'Virtual' },
		{ id: 'todos', nombre: 'Todos' }
	];

	let filtro = $state<Filtro>('todos');
	let cola = $state<RespuestaCola | null>(null);
	let miAtencion = $state<Turno | null>(null);
	let error = $state('');
	let llamando = $state('');
	let actualizado = $state('');

	const enEspera = $derived(
		(cola?.turnos ?? []).filter(
			(t) => t.estado === 'en_espera' && (filtro === 'todos' || t.canal === filtro)
		)
	);
	const enAtencion = $derived((cola?.turnos ?? []).filter((t) => t.estado === 'atendiendo'));

	async function recargar() {
		const op = sesion.operador;
		if (!op) return;
		try {
			const [c, mia] = await Promise.all([
				pb.send<RespuestaCola>(`/api/citas/cola/${op.agencia}`, {}),
				pb.collection('turnos').getList<Turno>(1, 1, {
					filter: pb.filter('operador = {:op} && estado = "atendiendo"', { op: op.id }),
					sort: '-llamado_en'
				})
			]);
			cola = c;
			miAtencion = mia.items[0] ?? null;
			actualizado = new Date().toLocaleTimeString('es-PE', {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			});
			error = '';
		} catch (err) {
			error = mensajeError(err);
		}
	}

	onMount(() => {
		recargar();
		let pendiente: ReturnType<typeof setTimeout> | undefined;
		// Tiempo real: cualquier cambio en turnos refresca la cola (con un pequeño margen).
		const desuscribir = pb
			.collection('turnos')
			.subscribe('*', () => {
				clearTimeout(pendiente);
				pendiente = setTimeout(recargar, 300);
			})
			.catch(() => undefined);
		const respaldo = setInterval(recargar, 15000);
		return () => {
			clearInterval(respaldo);
			clearTimeout(pendiente);
			desuscribir.then((fn) => fn?.());
		};
	});

	async function llamar(item?: ItemCola) {
		llamando = item?.id ?? 'siguiente';
		error = '';
		try {
			const r = await pb.send<{ id: string; retomado: boolean }>('/api/panel/llamar', {
				method: 'POST',
				body: item ? { id: item.id } : { canal: filtro === 'todos' ? '' : filtro }
			});
			await goto(`/ventanilla/atencion/${r.id}`);
		} catch (err) {
			error = mensajeError(err);
			recargar();
		} finally {
			llamando = '';
		}
	}
</script>

<svelte:head>
	<title>Cola de turnos · Panel interno</title>
</svelte:head>

<BarraPersonal />

<div class="mx-auto grid max-w-6xl gap-6 px-5 py-8 md:grid-cols-[13rem_1fr]">
	<aside class="panel h-fit p-4">
		<fieldset>
			<legend class="mb-3 font-bold">Filtrar por canal</legend>
			<div class="flex flex-row flex-wrap gap-1 md:flex-col">
				{#each FILTROS as f (f.id)}
					<label
						class="flex cursor-pointer items-center gap-2 rounded-base px-3 py-2 {filtro === f.id
							? 'bg-surface-950 font-bold text-surface-50'
							: 'hover:bg-surface-100'}"
					>
						<input type="radio" class="sr-only" name="filtro" value={f.id} bind:group={filtro} />
						<span aria-hidden="true">{filtro === f.id ? '●' : '○'}</span>
						{f.nombre}
					</label>
				{/each}
			</div>
		</fieldset>
		{#if cola}
			<p class="mt-5 text-sm text-surface-700">
				{cola.ventanillas_activas} ventanillas activas<br />Actualizado {actualizado}
			</p>
		{/if}
	</aside>

	<main class="min-w-0">
		{#if miAtencion}
			<div class="nota mb-5 flex flex-wrap items-center justify-between gap-3">
				<span class="font-bold"
					>Tienes el turno <span class="codigo">{miAtencion.codigo}</span> en atención.</span
				>
				<a href="/ventanilla/atencion/{miAtencion.id}" class="btn-principal min-h-10">Abrir ficha</a
				>
			</div>
		{/if}

		{#if error}
			<p class="error-caja mb-5" role="alert">{error}</p>
		{/if}

		<h1 class="text-xl font-bold">Cola de turnos</h1>

		<div class="panel mt-3 overflow-x-auto">
			<table class="tabla">
				<caption class="sr-only">Turnos en espera, los prioritarios primero</caption>
				<thead>
					<tr>
						<th scope="col">Turno</th>
						<th scope="col">Trámite</th>
						<th scope="col">Prioridad</th>
						<th scope="col">Canal</th>
						<th scope="col">Cita</th>
						<th scope="col">Espera</th>
						<th scope="col"><span class="sr-only">Acción</span></th>
					</tr>
				</thead>
				<tbody>
					{#each enEspera as t, i (t.id)}
						<tr class={i === 0 ? 'bg-surface-100 font-bold' : ''}>
							<td class="codigo">{i === 0 ? '▶ ' : ''}{t.codigo}</td>
							<td>{t.servicio}</td>
							<td
								>{#if t.prioridad}<span class="text-warning-700">★</span> sí{:else}—{/if}</td
							>
							<td>{NOMBRE_CANAL[t.canal]}</td>
							<td class="codigo">{hora12(t.hora)}</td>
							<td>~{t.espera_min} min</td>
							<td class="text-right">
								<button
									type="button"
									class="btn min-h-9 border border-surface-400 px-3 text-sm font-bold hover:bg-surface-200"
									disabled={llamando !== '' || !!miAtencion}
									onclick={() => llamar(t)}
								>
									{llamando === t.id ? 'Llamando…' : 'Llamar'}
								</button>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="py-8 text-center text-surface-700">
								{cola ? 'No hay turnos en espera para este filtro.' : 'Cargando cola…'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<button
			type="button"
			class="btn-principal mt-6"
			disabled={llamando !== '' || !!miAtencion || enEspera.length === 0}
			onclick={() => llamar()}
		>
			{llamando === 'siguiente' ? 'Llamando…' : 'Llamar siguiente turno'}
		</button>

		{#if enAtencion.length}
			<section class="mt-10" aria-labelledby="t-atencion">
				<h2 id="t-atencion" class="text-lg font-bold">En atención ahora</h2>
				<ul class="mt-3 flex flex-wrap gap-3">
					{#each enAtencion as t (t.id)}
						<li class="panel px-4 py-3 text-sm">
							<span class="codigo font-bold">{t.codigo}</span> · {t.servicio} ·
							{t.canal === 'plataforma' ? 'Videollamada' : `Ventanilla ${t.ventanilla ?? ''}`}
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</main>
</div>
