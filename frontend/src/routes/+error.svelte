<script lang="ts">
	import { page } from '$app/state';
	import Encabezado from '$lib/components/Encabezado.svelte';
</script>

<Encabezado titulo="Banco de la Nación — Portal de Citas Presenciales" enlace="/" />
<main class="mx-auto max-w-lg px-5 py-16">
	<h1 class="text-2xl font-bold">
		{page.status === 404 ? 'Esta página no existe' : 'Algo no funcionó'}
	</h1>
	<p class="mt-3 text-surface-800">
		{page.status === 404
			? 'Revisa la dirección o vuelve al inicio para identificarte.'
			: (page.error?.message ?? 'Vuelve al inicio e inténtalo otra vez.')}
	</p>
	<a href="/" class="btn-principal mt-8">Volver al inicio</a>
</main>
