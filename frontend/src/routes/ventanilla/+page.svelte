<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Encabezado from '$lib/components/Encabezado.svelte';
	import { pb } from '$lib/pocketbase';
	import { panel } from '$lib/stores/panel.svelte';
	import { sesion } from '$lib/stores/sesion.svelte';
	import { mensajeError } from '$lib/util';

	// Figura 2.5 — Login del administrador / operador con credenciales institucionales.
	let usuario = $state('');
	let clave = $state('');
	let error = $state('');
	let enviando = $state(false);

	onMount(() => {
		if (sesion.operador) goto('/ventanilla/cola', { replaceState: true });
	});

	async function ingresar(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		enviando = true;
		try {
			// Si había una sesión de cliente en este navegador, se reemplaza.
			pb.authStore.clear();
			panel.limpiar();
			await pb.collection('users').authWithPassword(usuario.trim().toLowerCase(), clave);
			await goto('/ventanilla/cola');
		} catch (err) {
			error = mensajeError(err);
		} finally {
			enviando = false;
		}
	}
</script>

<svelte:head>
	<title>Acceso de personal · Banco de la Nación</title>
</svelte:head>

<Encabezado titulo="Panel interno — Personal de agencia">
	{#snippet derecha()}
		<a href="/" class="hover:underline">Portal de clientes</a>
	{/snippet}
</Encabezado>

<main class="mx-auto flex max-w-md flex-col px-5 pt-14 pb-20">
	<h1 class="text-center text-2xl font-bold">Acceso de personal</h1>

	<form class="mt-8 flex flex-col gap-5" onsubmit={ingresar}>
		<label>
			<span class="etiqueta">Usuario o correo institucional</span>
			<input
				class="campo w-full"
				bind:value={usuario}
				autocomplete="username"
				autocapitalize="none"
				spellcheck="false"
				required
			/>
		</label>
		<label>
			<span class="etiqueta">Contraseña</span>
			<input
				type="password"
				class="campo w-full"
				bind:value={clave}
				autocomplete="current-password"
				required
			/>
		</label>

		{#if error}
			<p class="error-caja" role="alert">{error}</p>
		{/if}

		<button type="submit" class="btn-principal w-full" disabled={enviando || !usuario || !clave}>
			{enviando ? 'Ingresando…' : 'Ingresar al panel'}
		</button>
	</form>

	<p class="nota mt-6 text-center">
		Acceso restringido: se usan credenciales institucionales, no el DNI del cliente.
	</p>
</main>
