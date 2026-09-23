<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import EstadoTurno from '$lib/components/EstadoTurno.svelte';
	import { pb } from '$lib/pocketbase';
	import type { Turno } from '$lib/tipos';
	import {
		NOMBRE_DOCUMENTO,
		NOMBRE_PRIORIDAD,
		enmascararParcial,
		fechaCorta,
		hora12,
		horaDeCampo,
		mensajeError,
		soles
	} from '$lib/util';

	// Figura 2.7 — Ficha de contexto del trámite: lo que el cliente ya ingresó desde la app.
	let turno = $state<Turno | null>(null);
	let error = $state('');
	let procesando = $state('');

	async function cargar(id: string) {
		try {
			turno = await pb
				.collection('turnos')
				.getOne<Turno>(id, { expand: 'cliente,servicio,ventanilla,agencia' });
			error = '';
		} catch (err) {
			error = mensajeError(err);
		}
	}

	$effect(() => {
		cargar(page.params.id ?? '');
	});

	async function finalizar(resultado: 'atendido' | 'no_asistio') {
		if (!turno) return;
		if (
			resultado === 'no_asistio' &&
			!confirm(`¿Marcar el turno ${turno.codigo} como «no se presentó»?`)
		)
			return;
		procesando = resultado;
		try {
			await pb.send(`/api/panel/turno/${turno.id}/finalizar`, {
				method: 'POST',
				body: { resultado }
			});
			await goto('/ventanilla/cola');
		} catch (err) {
			error = mensajeError(err);
			await cargar(turno.id);
		} finally {
			procesando = '';
		}
	}

	const cliente = $derived(turno?.expand?.cliente);
	const enAtencion = $derived(turno?.estado === 'atendiendo');
</script>

<svelte:head>
	<title>{turno ? `Atención ${turno.codigo}` : 'Ficha de atención'} · Panel interno</title>
</svelte:head>

<div class="banda">
	<a href="/ventanilla/cola" class="font-bold hover:underline">‹ Volver a la cola</a>
	<p class="font-bold">Ficha de atención</p>
</div>

<main class="mx-auto max-w-5xl px-5 py-8">
	{#if error}
		<p class="error-caja mb-5" role="alert">{error}</p>
	{/if}

	{#if !turno}
		{#if !error}<p class="text-surface-700">Cargando ficha…</p>{/if}
	{:else}
		<div class="grid items-start gap-8 md:grid-cols-[1.2fr_1fr]">
			<section>
				<h1 class="text-2xl font-bold">
					Turno <span class="codigo">{turno.codigo}</span> — {turno.expand?.servicio?.nombre}
				</h1>
				<p class="mt-2 flex flex-wrap items-center gap-3 text-sm">
					<EstadoTurno estado={turno.estado} />
					<span>Cita: {fechaCorta(turno.fecha)} {hora12(turno.hora)}</span>
					{#if turno.llamado_en}<span>Llamado: {horaDeCampo(turno.llamado_en)}</span>{/if}
				</p>

				<dl class="panel mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 p-5">
					<dt class="text-surface-700">Documento</dt>
					<dd class="codigo">
						{cliente
							? `${NOMBRE_DOCUMENTO[cliente.tipo_documento]} ${enmascararParcial(cliente.numero_documento)}`
							: '—'}
					</dd>
					<dt class="text-surface-700">Cliente</dt>
					<dd class="font-bold">{cliente?.nombres || 'Sin nombre en el padrón'}</dd>
					<dt class="text-surface-700">Monto aprox.</dt>
					<dd>{turno.monto_aprox ? soles(turno.monto_aprox) : 'No indicado'}</dd>
					<dt class="text-surface-700">Observación</dt>
					<dd>{turno.observacion || 'Sin observaciones'}</dd>
					{#if turno.prioridad}
						<dt class="text-surface-700">Prioridad</dt>
						<dd class="font-bold">
							★ {turno.tipo_prioridad ? NOMBRE_PRIORIDAD[turno.tipo_prioridad] : 'Sí'}
						</dd>
					{/if}
				</dl>

				<h2 class="mt-6 font-bold">Validación con sistema legado</h2>
				{#if cliente?.verificado_legado}
					<p
						class="mt-2 inline-block rounded-full border border-success-600 px-3 py-1 text-sm font-bold text-success-800"
					>
						✔ Verificado en Mainframe/AS400
					</p>
				{:else}
					<p
						class="mt-2 inline-block rounded-full border border-warning-600 px-3 py-1 text-sm font-bold text-warning-900"
					>
						⚠ No figura en el padrón: validar con el documento físico
					</p>
				{/if}
			</section>

			<section class="flex flex-col gap-4">
				{#if turno.canal === 'plataforma'}
					<div class="panel border-dashed p-4">
						<p class="text-sm font-bold">🔗 Canal: Plataforma — enlace Meet</p>
						<p class="codigo mt-1 text-sm break-all">{turno.enlace_meet}</p>
					</div>
					<a
						href={turno.enlace_meet}
						target="_blank"
						rel="noopener noreferrer"
						class="btn-secundario w-full"
					>
						Unirse a la reunión
					</a>
				{:else}
					<div class="panel p-4">
						<p class="text-sm font-bold">Canal: Ventanilla — atención presencial</p>
						<p class="mt-1 text-sm text-surface-800">
							Ventanilla {turno.expand?.ventanilla?.numero ?? '—'} · {turno.expand?.agencia?.nombre}
						</p>
					</div>
				{/if}

				<button
					type="button"
					class="btn-principal w-full"
					disabled={!enAtencion || procesando !== ''}
					onclick={() => finalizar('atendido')}
				>
					{procesando === 'atendido' ? 'Finalizando…' : 'Finalizar atención'}
				</button>
				<button
					type="button"
					class="btn-secundario w-full"
					disabled={!enAtencion || procesando !== ''}
					onclick={() => finalizar('no_asistio')}
				>
					No se presentó
				</button>
				{#if !enAtencion}
					<p class="text-sm text-surface-700">Este turno ya no está en atención.</p>
				{/if}
			</section>
		</div>
	{/if}
</main>
