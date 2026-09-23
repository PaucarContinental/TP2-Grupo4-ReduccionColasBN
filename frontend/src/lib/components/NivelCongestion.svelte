<script lang="ts">
	import type { NivelCongestion } from '$lib/tipos';
	import { NOMBRE_NIVEL } from '$lib/util';

	let { nivel }: { nivel: NivelCongestion } = $props();
	const llenas = $derived(nivel === 'baja' ? 1 : nivel === 'media' ? 2 : 3);
</script>

<span class="flex items-center gap-2 text-xs">
	<span class="flex gap-0.5" aria-hidden="true">
		{#each [1, 2, 3] as n (n)}
			<span class="h-3 w-1.5 rounded-sm {n <= llenas ? 'bg-surface-800' : 'bg-surface-300'}"></span>
		{/each}
	</span>
	{NOMBRE_NIVEL[nivel]}
</span>
