<script lang="ts">
	interface Props {
		pasos: string[];
		actual: number;
	}

	let { pasos, actual }: Props = $props();
</script>

<ol class="flex gap-2" aria-label="Progreso de la solicitud">
	{#each pasos as paso, i (paso)}
		{@const estado = i < actual ? 'hecho' : i === actual ? 'actual' : 'pendiente'}
		<li class="flex flex-1 flex-col gap-2" aria-current={estado === 'actual' ? 'step' : undefined}>
			<span
				class="h-1.5 rounded-full {estado === 'pendiente' ? 'bg-surface-300' : 'bg-surface-900'}"
			></span>
			<span class="text-sm {estado === 'actual' ? 'font-bold' : 'text-surface-700'}">
				Paso {i + 1} de {pasos.length}<span class="sr-only">:</span>
				<span class="block">{paso}</span>
			</span>
		</li>
	{/each}
</ol>
