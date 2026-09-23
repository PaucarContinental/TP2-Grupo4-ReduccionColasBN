<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import NivelCongestion from '$lib/components/NivelCongestion.svelte';
	import Pasos from '$lib/components/Pasos.svelte';
	import { pb } from '$lib/pocketbase';
	import type { Agencia, Canal, RespuestaHorarios, Servicio, TipoPrioridad } from '$lib/tipos';
	import {
		NOMBRE_CANAL,
		NOMBRE_PRIORIDAD,
		esDomingo,
		fechaLarga,
		hora12,
		hoyPeru,
		mensajeError,
		soles,
		sumarDias
	} from '$lib/util';

	// Figura 2.2 — Selección de canal y trámite, organizada en tres pasos visibles (stepper).
	const PASOS = ['Canal y trámite', 'Horario', 'Confirmar'];

	let paso = $state(0);
	let agencias = $state<Agencia[]>([]);
	let servicios = $state<Servicio[]>([]);
	let cargando = $state(true);
	let error = $state('');

	let canal = $state<Canal | ''>('');
	let agenciaId = $state('');
	let servicioId = $state('');
	let prioridad = $state(false);
	let tipoPrioridad = $state<TipoPrioridad | ''>('');

	let fecha = $state(hoyPeru());
	let horarios = $state<RespuestaHorarios | null>(null);
	let cargandoHorarios = $state(false);
	let hora = $state('');

	let monto = $state<number | null>(null);
	let observacion = $state('');
	let enviando = $state(false);

	const agencia = $derived(agencias.find((a) => a.id === agenciaId));
	const servicio = $derived(servicios.find((s) => s.id === servicioId));
	const pasoUnoListo = $derived(
		canal !== '' && agenciaId !== '' && servicioId !== '' && (!prioridad || tipoPrioridad !== '')
	);
	const disponibles = $derived(horarios?.franjas.filter((f) => f.disponible) ?? []);

	// Próximos días hábiles (lunes a sábado) dentro de la ventana de 14 días.
	const dias = $derived.by(() => {
		const lista: string[] = [];
		for (let i = 0; i <= 14 && lista.length < 8; i++) {
			const f = sumarDias(hoyPeru(), i);
			if (!esDomingo(f)) lista.push(f);
		}
		return lista;
	});

	onMount(async () => {
		try {
			const [a, s] = await Promise.all([
				pb.collection('agencias').getFullList<Agencia>({ filter: 'activa = true', sort: 'nombre' }),
				pb.collection('servicios').getFullList<Servicio>({ filter: 'activo = true', sort: 'orden' })
			]);
			agencias = a;
			servicios = s;
			agenciaId = (a.find((x) => x.nombre.includes('Cusco')) ?? a[0])?.id ?? '';
			if (esDomingo(fecha)) fecha = sumarDias(fecha, 1);
		} catch (err) {
			error = mensajeError(err);
		} finally {
			cargando = false;
		}
	});

	async function cargarHorarios() {
		if (!agenciaId) return;
		cargandoHorarios = true;
		error = '';
		hora = '';
		try {
			horarios = await pb.send<RespuestaHorarios>('/api/citas/horarios', {
				query: { agencia: agenciaId, fecha }
			});
			// Prevención de errores: el horario recomendado queda preseleccionado.
			hora = horarios.franjas.find((f) => f.recomendado)?.hora ?? '';
		} catch (err) {
			horarios = null;
			error = mensajeError(err);
		} finally {
			cargandoHorarios = false;
		}
	}

	function irA(n: number) {
		error = '';
		paso = n;
		if (n === 1 && (!horarios || horarios.agencia !== agenciaId || horarios.fecha !== fecha)) {
			cargarHorarios();
		}
		window.scrollTo({ top: 0 });
	}

	function elegirFecha(f: string) {
		fecha = f;
		cargarHorarios();
	}

	async function generarTicket() {
		if (!canal || !hora) return;
		enviando = true;
		error = '';
		try {
			const r = await pb.send<{ id: string; codigo: string }>('/api/citas/turno', {
				method: 'POST',
				body: {
					agencia: agenciaId,
					servicio: servicioId,
					canal,
					prioridad,
					tipo_prioridad: prioridad ? tipoPrioridad : '',
					fecha,
					hora,
					monto_aprox: monto ?? 0,
					observacion
				}
			});
			await goto(`/ticket/${r.id}`);
		} catch (err) {
			error = mensajeError(err);
			// Si el horario se ocupó mientras tanto, se recalculan las sugerencias.
			if (error.includes('horario')) {
				paso = 1;
				cargarHorarios();
			}
		} finally {
			enviando = false;
		}
	}

	const etiquetaDia = (f: string) =>
		f === hoyPeru() ? 'Hoy' : f === sumarDias(hoyPeru(), 1) ? 'Mañana' : fechaLarga(f);
</script>

<svelte:head>
	<title>Solicitar cita · Banco de la Nación</title>
</svelte:head>

<main class="mx-auto max-w-4xl px-5 py-8">
	<Pasos pasos={PASOS} actual={paso} />

	{#if error}
		<p class="error-caja mt-6" role="alert">{error}</p>
	{/if}

	{#if cargando}
		<p class="mt-10 text-surface-700">Cargando trámites…</p>
	{:else if paso === 0}
		<!-- PASO 1: canal, agencia y trámite -->
		<section class="mt-8" aria-labelledby="t-canal">
			<h1 id="t-canal" class="text-xl font-bold">¿Cómo deseas ser atendido?</h1>
			<div class="mt-4 grid gap-4 sm:grid-cols-2" role="radiogroup" aria-labelledby="t-canal">
				{#each [{ valor: 'ventanilla', icono: '🏦', detalle: 'Atención presencial en agencia' }, { valor: 'plataforma', icono: '💻', detalle: 'Atención por videollamada' }] as op (op.valor)}
					{@const activo = canal === op.valor}
					<button
						type="button"
						role="radio"
						aria-checked={activo}
						class="flex min-h-28 flex-col items-center justify-center gap-1 rounded-container border-2 p-5 text-center transition-colors {activo
							? 'border-surface-950 bg-surface-200'
							: 'border-surface-300 bg-white hover:border-surface-500'}"
						onclick={() => (canal = op.valor as Canal)}
					>
						<span class="text-2xl" aria-hidden="true">{op.icono}</span>
						<span class="text-lg font-bold">{NOMBRE_CANAL[op.valor as Canal]}</span>
						<span class="text-sm text-surface-800">{op.detalle}</span>
					</button>
				{/each}
			</div>
		</section>

		<section class="mt-8">
			<label class="block max-w-md">
				<span class="etiqueta">Agencia</span>
				<select class="selector w-full" bind:value={agenciaId}>
					{#each agencias as a (a.id)}
						<option value={a.id}>{a.nombre}</option>
					{/each}
				</select>
			</label>
			{#if canal === 'plataforma'}
				<p class="mt-2 text-sm text-surface-700">
					En videollamada te atiende el personal de la agencia elegida.
				</p>
			{/if}
		</section>

		<section class="mt-8" aria-labelledby="t-tramite">
			<h2 id="t-tramite" class="text-xl font-bold">Tipo de trámite</h2>
			<div class="mt-4 flex flex-wrap gap-3" role="radiogroup" aria-labelledby="t-tramite">
				{#each servicios as s (s.id)}
					{@const activo = servicioId === s.id}
					<button
						type="button"
						role="radio"
						aria-checked={activo}
						class="min-h-11 rounded-full border-2 px-5 py-2 font-bold transition-colors {activo
							? 'border-surface-950 bg-surface-950 text-surface-50'
							: 'border-surface-400 bg-white hover:border-surface-700'}"
						onclick={() => (servicioId = s.id)}
					>
						{s.nombre}
					</button>
				{/each}
			</div>
		</section>

		<section class="panel mt-8 max-w-xl p-4">
			<label class="flex items-start gap-3">
				<input type="checkbox" class="mt-1 checkbox size-5" bind:checked={prioridad} />
				<span>
					<span class="font-bold">Solicito atención prioritaria</span>
					<span class="block text-sm text-surface-800"
						>Adulto mayor, gestante o persona con discapacidad.</span
					>
				</span>
			</label>
			{#if prioridad}
				<fieldset class="mt-4 flex flex-wrap gap-x-6 gap-y-2 pl-8">
					<legend class="sr-only">Motivo de la prioridad</legend>
					{#each Object.entries(NOMBRE_PRIORIDAD) as [valor, nombre] (valor)}
						<label class="flex items-center gap-2">
							<input
								type="radio"
								class="radio"
								name="prioridad"
								value={valor}
								bind:group={tipoPrioridad}
							/>
							{nombre}
						</label>
					{/each}
				</fieldset>
				<p class="mt-3 pl-8 text-sm text-surface-700">
					En agencia se te pedirá acreditarlo con tu documento.
				</p>
			{/if}
		</section>

		<div class="mt-10 flex justify-end">
			<button type="button" class="btn-principal" disabled={!pasoUnoListo} onclick={() => irA(1)}>
				Continuar
			</button>
		</div>
	{:else if paso === 1}
		<!-- PASO 2: horario sugerido por el modelo de afluencia -->
		<section class="mt-8">
			<h1 class="text-xl font-bold">Elige el día y la hora</h1>
			<p class="mt-1 text-surface-800">
				Te sugerimos los horarios con menos gente en {agencia?.nombre}.
			</p>

			<div
				class="mt-5 flex gap-2 overflow-x-auto pb-2"
				role="radiogroup"
				aria-label="Día de la cita"
			>
				{#each dias as d (d)}
					{@const activo = fecha === d}
					<button
						type="button"
						role="radio"
						aria-checked={activo}
						class="min-h-11 shrink-0 rounded-base border-2 px-4 py-2 text-sm font-bold first-letter:uppercase {activo
							? 'border-surface-950 bg-surface-950 text-surface-50'
							: 'border-surface-300 bg-white'}"
						onclick={() => elegirFecha(d)}
					>
						{etiquetaDia(d)}
					</button>
				{/each}
			</div>

			{#if cargandoHorarios}
				<p class="mt-8 text-surface-700">Calculando la afluencia de cada horario…</p>
			{:else if horarios && disponibles.length === 0}
				<p class="nota mt-8">
					{horarios.franjas.length === 0
						? 'La agencia no atiende ese día.'
						: 'Ya no quedan horarios disponibles ese día.'} Elige otro día de la lista.
				</p>
			{:else if horarios}
				<div
					class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
					role="radiogroup"
					aria-label="Horario"
				>
					{#each horarios.franjas as f (f.hora)}
						{@const activo = hora === f.hora}
						<button
							type="button"
							role="radio"
							aria-checked={activo}
							disabled={!f.disponible}
							class="relative flex min-h-20 flex-col items-start gap-1.5 rounded-base border-2 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 {activo
								? 'border-surface-950 bg-surface-100'
								: f.recomendado
									? 'border-warning-600 bg-white'
									: 'border-surface-300 bg-white'}"
							onclick={() => (hora = f.hora)}
						>
							<span class="codigo text-lg font-bold">{hora12(f.hora)}</span>
							{#if f.disponible}
								<NivelCongestion nivel={f.nivel} />
							{:else}
								<span class="text-xs">No disponible</span>
							{/if}
							{#if f.recomendado}
								<span
									class="absolute -top-2.5 right-2 rounded-full bg-warning-400 px-2 text-xs font-bold text-warning-950"
								>
									Recomendado
								</span>
							{/if}
						</button>
					{/each}
				</div>
				<p class="mt-4 text-sm text-surface-700">
					La afluencia se estima con el historial de la agencia y las citas ya reservadas.
				</p>
			{/if}
		</section>

		<div class="mt-10 flex justify-between gap-3">
			<button type="button" class="btn-secundario" onclick={() => irA(0)}>Atrás</button>
			<button type="button" class="btn-principal" disabled={!hora} onclick={() => irA(2)}
				>Continuar</button
			>
		</div>
	{:else}
		<!-- PASO 3: datos adicionales y confirmación -->
		<section class="mt-8 grid gap-8 md:grid-cols-[1fr_1.1fr]">
			<div>
				<h1 class="text-xl font-bold">Revisa tu cita</h1>
				<dl class="panel mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 p-5">
					<dt class="text-surface-700">Canal</dt>
					<dd class="font-bold">{canal ? NOMBRE_CANAL[canal] : ''}</dd>
					<dt class="text-surface-700">Trámite</dt>
					<dd class="font-bold">{servicio?.nombre}</dd>
					<dt class="text-surface-700">Agencia</dt>
					<dd>{agencia?.nombre}</dd>
					<dt class="text-surface-700">Día</dt>
					<dd class="first-letter:uppercase">{fechaLarga(fecha)}</dd>
					<dt class="text-surface-700">Hora</dt>
					<dd class="codigo font-bold">{hora12(hora)}</dd>
					{#if prioridad && tipoPrioridad}
						<dt class="text-surface-700">Prioridad</dt>
						<dd>★ {NOMBRE_PRIORIDAD[tipoPrioridad]}</dd>
					{/if}
				</dl>
			</div>
			<div>
				<h2 class="text-xl font-bold">
					Datos para el operador <span class="text-base font-normal text-surface-700"
						>(opcional)</span
					>
				</h2>
				<p class="mt-1 text-sm text-surface-800">Así no tendrás que repetirlos en ventanilla.</p>
				<label class="mt-4 block">
					<span class="etiqueta">Monto aproximado (S/)</span>
					<input
						type="number"
						min="0"
						step="0.01"
						class="campo w-full"
						bind:value={monto}
						placeholder="0.00"
					/>
				</label>
				{#if monto}
					<p class="mt-1 text-sm text-surface-700">{soles(monto)}</p>
				{/if}
				<label class="mt-4 block">
					<span class="etiqueta">Observación</span>
					<textarea
						class="textarea w-full border-surface-400 bg-white px-4 py-3"
						rows="3"
						maxlength="300"
						bind:value={observacion}
						placeholder="Ej.: primera solicitud, sin cuenta CTS previa"
					></textarea>
				</label>
			</div>
		</section>

		<div class="mt-10 flex justify-between gap-3">
			<button type="button" class="btn-secundario" onclick={() => irA(1)}>Atrás</button>
			<button type="button" class="btn-principal" disabled={enviando} onclick={generarTicket}>
				{enviando ? 'Generando…' : 'Generar ticket'}
			</button>
		</div>
	{/if}
</main>
