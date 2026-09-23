<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		titulo: string;
		enlace?: string;
		derecha?: Snippet;
	}

	let { titulo, enlace, derecha }: Props = $props();
</script>

<header class="banda">
	{#if enlace}
		<a href={enlace} class="font-bold hover:underline">{titulo}</a>
	{:else}
		<p class="font-bold">{titulo}</p>
	{/if}
	{#if derecha}
		<nav class="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Opciones de la cuenta">
			{@render derecha()}
		</nav>
	{/if}
</header>
