<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { RecordModel } from 'pocketbase';
	import Encabezado from '$lib/components/Encabezado.svelte';
	import { pb } from '$lib/pocketbase';
	import { sesion } from '$lib/stores/sesion.svelte';
	import type { TipoDocumento, Turno } from '$lib/tipos';
	import { NOMBRE_DOCUMENTO, hoyPeru, mensajeError } from '$lib/util';

	// Figura 2.1 — Login del usuario: identificación solo con el documento.
	let tipo = $state<TipoDocumento>('DNI');
	let numero = $state('');
	let error = $state('');
	let enviando = $state(false);
	let ayuda = $state(false);

	const reglas: Record<TipoDocumento, { max: number; modo: 'numeric' | 'text'; pista: string }> = {
		DNI: { max: 8, modo: 'numeric', pista: '8 dígitos' },
		CE: { max: 9, modo: 'numeric', pista: '9 dígitos' },
		PTP: { max: 9, modo: 'numeric', pista: '9 dígitos' },
		PASAPORTE: { max: 12, modo: 'text', pista: 'De 6 a 12 letras o números' }
	};
	const regla = $derived(reglas[tipo]);

	onMount(() => {
		if (sesion.cliente) goto('/mis-citas', { replaceState: true });
	});

	async function ingresar(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		enviando = true;
		try {
			const datos = await pb.send<{ token: string; record: RecordModel }>(
				'/api/citas/identificar',
				{
					method: 'POST',
					body: { tipo_documento: tipo, numero_documento: numero.trim() }
				}
			);
			pb.authStore.save(datos.token, datos.record);

			// Si ya tiene citas activas, va a su seguimiento; si no, directo a pedir una.
			const activas = await pb.collection('turnos').getList<Turno>(1, 1, {
				filter: pb.filter('fecha >= {:hoy} && (estado = "en_espera" || estado = "atendiendo")', {
					hoy: hoyPeru()
				})
			});
			await goto(activas.totalItems > 0 ? '/mis-citas' : '/nueva-cita');
		} catch (err) {
			error = mensajeError(err);
		} finally {
			enviando = false;
		}
	}
</script>

<svelte:head>
	<title>Identifícate · Citas Banco de la Nación</title>
</svelte:head>

<Encabezado titulo="Banco de la Nación — Portal de Citas Presenciales">
	{#snippet derecha()}
		<button
			type="button"
			class="hover:underline"
			onclick={() => (ayuda = !ayuda)}
			aria-expanded={ayuda}
		>
			Ayuda
		</button>
		<a href="/ventanilla" class="hover:underline">Personal del banco</a>
	{/snippet}
</Encabezado>

<main class="mx-auto flex max-w-md flex-col px-5 pt-14 pb-20">
	<h1 class="text-center text-2xl font-bold">Identifícate para continuar</h1>
	<p class="mt-2 text-center text-surface-800">
		Reserva tu atención en agencia o por videollamada sin hacer cola.
	</p>

	{#if ayuda}
		<div class="panel mt-6 p-4 text-sm leading-relaxed">
			<p class="font-bold">¿Cómo funciona?</p>
			<p class="mt-1">
				Escribe tu documento, elige tu trámite y el horario con menos gente. Recibirás un ticket con
				tu número de turno. En ventanilla ya tendrán los datos de tu trámite.
			</p>
		</div>
	{/if}

	<form class="mt-8 flex flex-col gap-5" onsubmit={ingresar} novalidate>
		<label>
			<span class="etiqueta">Tipo de documento</span>
			<select class="selector w-full" bind:value={tipo} onchange={() => (numero = '')}>
				{#each Object.entries(NOMBRE_DOCUMENTO) as [valor, nombre] (valor)}
					<option value={valor}>{nombre}</option>
				{/each}
			</select>
		</label>

		<label>
			<span class="etiqueta">Número de documento</span>
			<input
				class="campo codigo w-full text-lg"
				bind:value={numero}
				inputmode={regla.modo}
				maxlength={regla.max}
				autocomplete="off"
				spellcheck="false"
				placeholder={regla.pista}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? 'error-login' : undefined}
				required
			/>
		</label>

		{#if error}
			<p id="error-login" class="error-caja" role="alert">{error}</p>
		{/if}

		<button type="submit" class="btn-principal w-full" disabled={enviando || !numero.trim()}>
			{enviando ? 'Verificando…' : 'Ingresar'}
		</button>
	</form>

	<p class="nota mt-6 text-center">
		No necesitas usuario ni contraseña: te identificas solo con tu documento, que se verifica con
		los registros del banco.
	</p>
</main>
