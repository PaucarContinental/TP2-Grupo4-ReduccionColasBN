<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { pb } from '$lib/pocketbase';

	let { children } = $props();

	onMount(() => {
		// Renueva el token guardado; si ya no es válido, se cierra la sesión.
		const registro = pb.authStore.record;
		if (pb.authStore.isValid && registro) {
			pb.collection(registro.collectionName)
				.authRefresh()
				.catch(() => pb.authStore.clear());
		}
	});
</script>

<svelte:head>
	<title>Citas presenciales · Banco de la Nación</title>
</svelte:head>

{@render children()}
