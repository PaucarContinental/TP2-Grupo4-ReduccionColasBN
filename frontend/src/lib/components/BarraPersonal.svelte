<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Encabezado from '$lib/components/Encabezado.svelte';
	import { panel } from '$lib/stores/panel.svelte';
	import { sesion } from '$lib/stores/sesion.svelte';
	import { mensajeError } from '$lib/util';

	let { titulo = '' }: { titulo?: string } = $props();
	let error = $state('');

	onMount(() => {
		if (sesion.operador) panel.cargar(sesion.operador).catch((e) => (error = mensajeError(e)));
	});

	function salir() {
		sesion.salir();
		panel.limpiar();
		goto('/ventanilla');
	}
</script>

<Encabezado titulo={titulo || panel.agencia?.nombre || 'Panel interno'}>
	{#snippet derecha()}
		{#if titulo && panel.agencia}
			<span class="font-bold">{panel.agencia.nombre}</span>
		{/if}
		{#if panel.ventanilla}
			<span class="codigo font-bold"
				>Ventanilla {String(panel.ventanilla.numero).padStart(2, '0')}</span
			>
		{/if}
		<span class="text-surface-800">{sesion.operador?.name}</span>
		<a href="/ventanilla/cola" class="hover:underline">Cola</a>
		{#if sesion.esAdmin}
			<a href="/admin" class="hover:underline">Administración</a>
		{/if}
		<a
			href="/pantalla?agencia={sesion.operador?.agencia}"
			target="_blank"
			rel="noopener"
			class="hover:underline">Pantalla de llamados</a
		>
		<button type="button" class="hover:underline" onclick={salir}>Salir</button>
	{/snippet}
</Encabezado>
{#if error}
	<p class="error-caja m-4" role="alert">{error}</p>
{/if}
