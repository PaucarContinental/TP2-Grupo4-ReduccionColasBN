<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import PantallaTurnos from '$lib/components/PantallaTurnos.svelte';
	import { pb } from '$lib/pocketbase';
	import type { Agencia, RespuestaCola } from '$lib/tipos';
	import { mensajeError } from '$lib/util';

	// Monitor de llamados para la sala de espera de la agencia (pública, sin datos personales).
	const REFRESCO_MS = 3000;

	let agencias = $state<Agencia[]>([]);
	let cola = $state<RespuestaCola | null>(null);
	let error = $state('');
	let reloj = $state('');

	const agenciaId = $derived(page.url.searchParams.get('agencia') ?? '');
	const agencia = $derived(agencias.find((a) => a.id === agenciaId));
	const llamados = $derived(
		(cola?.turnos ?? [])
			.filter((t) => t.estado === 'atendiendo')
			.sort((a, b) => (a.llamado_en < b.llamado_en ? 1 : -1))
	);
	const proximos = $derived(
		(cola?.turnos ?? []).filter((t) => t.estado === 'en_espera').slice(0, 6)
	);

	async function actualizar() {
		reloj = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
		if (!agenciaId) return;
		try {
			cola = await pb.send<RespuestaCola>(`/api/citas/cola/${agenciaId}`, {});
			error = '';
		} catch (err) {
			error = mensajeError(err);
		}
	}

	onMount(() => {
		pb.collection('agencias')
			.getFullList<Agencia>({ filter: 'activa = true', sort: 'nombre' })
			.then((a) => (agencias = a))
			.catch((err) => (error = mensajeError(err)));
		const intervalo = setInterval(actualizar, REFRESCO_MS);
		return () => clearInterval(intervalo);
	});

	$effect(() => {
		void agenciaId;
		cola = null;
		actualizar();
	});
</script>

<svelte:head>
	<title>Pantalla de llamados{agencia ? ` · ${agencia.nombre}` : ''}</title>
</svelte:head>

<div class="flex min-h-dvh flex-col bg-surface-950 p-6 text-surface-50 lg:p-10">
	<header class="flex flex-wrap items-baseline justify-between gap-4">
		<h1 class="text-2xl font-bold lg:text-3xl">{agencia?.nombre ?? 'Banco de la Nación'}</h1>
		<p class="codigo text-2xl text-surface-300">{reloj}</p>
	</header>

	{#if error}
		<p class="mt-4 text-error-300">{error}</p>
	{/if}

	<div class="mt-8 flex-1">
		{#if !agenciaId}
			<label class="block max-w-md">
				<span class="mb-2 block font-bold">Elige la agencia de esta pantalla</span>
				<select
					class="selector w-full text-surface-950"
					onchange={(e) => goto(`?agencia=${e.currentTarget.value}`)}
				>
					<option value="">Seleccionar…</option>
					{#each agencias as a (a.id)}
						<option value={a.id}>{a.nombre}</option>
					{/each}
				</select>
			</label>
		{:else}
			<PantallaTurnos {llamados} {proximos} />
		{/if}
	</div>

	<footer class="mt-8 text-sm text-surface-400">
		Reserva tu cita desde el portal web y llega a tu hora. Los turnos prioritarios (★) se atienden
		primero.
	</footer>
</div>
