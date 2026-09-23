<script lang="ts">
	import { goto } from '$app/navigation';
	import Encabezado from '$lib/components/Encabezado.svelte';
	import { sesion } from '$lib/stores/sesion.svelte';
	import { NOMBRE_DOCUMENTO, enmascarar } from '$lib/util';

	let { children } = $props();

	function salir() {
		sesion.salir();
		goto('/');
	}

	const saludo = $derived(
		sesion.cliente
			? `Hola, ${sesion.cliente.tipo_documento === 'DNI' ? 'DNI' : NOMBRE_DOCUMENTO[sesion.cliente.tipo_documento]} ${enmascarar(sesion.cliente.numero_documento)}`
			: ''
	);
</script>

<Encabezado titulo={saludo} enlace="/mis-citas">
	{#snippet derecha()}
		<a href="/mis-citas" class="hover:underline">Mis citas</a>
		<button type="button" class="hover:underline" onclick={salir}>Cerrar sesión</button>
	{/snippet}
</Encabezado>

{@render children()}
