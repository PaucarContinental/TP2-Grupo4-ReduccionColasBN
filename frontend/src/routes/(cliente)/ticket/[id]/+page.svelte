<script lang="ts">
	import { page } from '$app/state';
	import EstadoTurno from '$lib/components/EstadoTurno.svelte';
	import Ticket from '$lib/components/Ticket.svelte';
	import { pb } from '$lib/pocketbase';
	import type { Turno } from '$lib/tipos';
	import { NOMBRE_CANAL, fechaCorta, hora12, mensajeError } from '$lib/util';

	// Figura 2.3 — Ticket con número de turno.
	let turno = $state<Turno | null>(null);
	let error = $state('');
	let aviso = $state('');

	$effect(() => {
		const id = page.params.id ?? '';
		turno = null;
		error = '';
		pb.collection('turnos')
			.getOne<Turno>(id, { expand: 'servicio,agencia' })
			.then((t) => (turno = t))
			.catch((err) => (error = mensajeError(err)));
	});

	async function compartir() {
		if (!turno) return;
		const texto = `Mi turno en el Banco de la Nación: ${turno.codigo} · ${turno.expand?.servicio?.nombre ?? ''} · ${fechaCorta(turno.fecha)} ${hora12(turno.hora)} (${NOMBRE_CANAL[turno.canal]})`;
		try {
			if (navigator.share) {
				await navigator.share({ title: `Turno ${turno.codigo}`, text: texto });
			} else {
				await navigator.clipboard.writeText(texto);
				aviso = 'Datos del turno copiados. Ya puedes pegarlos en un mensaje.';
			}
		} catch {
			// La persona canceló el menú de compartir; no es un error.
		}
	}
</script>

<svelte:head>
	<title>{turno ? `Ticket ${turno.codigo}` : 'Ticket'} · Banco de la Nación</title>
</svelte:head>

<div class="banda border-surface-200 bg-surface-50">
	<p class="font-bold">Ticket generado</p>
	<div class="flex gap-4">
		<button type="button" class="hover:underline" onclick={() => window.print()} disabled={!turno}
			>Imprimir</button
		>
		<button type="button" class="hover:underline" onclick={compartir} disabled={!turno}
			>Compartir</button
		>
	</div>
</div>

<main class="mx-auto max-w-4xl px-5 py-8">
	{#if error}
		<p class="error-caja" role="alert">{error}</p>
		<a href="/mis-citas" class="btn-secundario mt-6">Ir a mis citas</a>
	{:else if !turno}
		<p class="text-surface-700">Cargando ticket…</p>
	{:else}
		<div class="grid items-start gap-8 md:grid-cols-[minmax(0,22rem)_1fr]">
			<div>
				<Ticket
					codigo={turno.codigo}
					canal={turno.canal}
					tramite={turno.expand?.servicio?.nombre ?? ''}
					fecha={turno.fecha}
					hora={turno.hora}
					agencia={turno.expand?.agencia?.nombre}
					prioridad={turno.prioridad}
				/>
				<p class="mt-4 flex items-center gap-2 text-sm">
					Estado: <EstadoTurno estado={turno.estado} />
				</p>
			</div>

			<div class="flex flex-col gap-4">
				{#if turno.canal === 'plataforma' && turno.enlace_meet}
					<div class="panel border-dashed p-4">
						<p class="text-sm font-bold">🔗 Enlace de videollamada (Google Meet)</p>
						<p class="codigo mt-1 text-sm break-all">{turno.enlace_meet}</p>
					</div>
					<a
						href={turno.enlace_meet}
						target="_blank"
						rel="noopener noreferrer"
						class="btn-secundario w-full"
					>
						Unirme a la reunión
					</a>
				{/if}

				<p class="nota">
					📍 Este ticket también sirve como referencia si prefieres acercarte a la agencia. Lleva tu
					documento de identidad vigente.
				</p>

				<button type="button" class="btn-principal w-full" onclick={() => window.print()}>
					Descargar / imprimir ticket
				</button>
				<a href="/mis-citas" class="btn-secundario w-full">Ver mi lugar en la cola</a>

				{#if aviso}
					<p class="text-sm text-surface-800" role="status">{aviso}</p>
				{/if}
			</div>
		</div>
	{/if}
</main>
