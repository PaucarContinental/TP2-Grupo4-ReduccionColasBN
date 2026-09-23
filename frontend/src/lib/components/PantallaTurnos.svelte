<script lang="ts">
	import type { ItemCola } from '$lib/tipos';

	interface Props {
		llamados: ItemCola[];
		proximos: ItemCola[];
	}

	let { llamados, proximos }: Props = $props();
	const ultimo = $derived(llamados[0]);
	const anteriores = $derived(llamados.slice(1, 5));

	const destino = (t: ItemCola) =>
		t.canal === 'plataforma'
			? 'Videollamada'
			: `Ventanilla ${String(t.ventanilla ?? '').padStart(2, '0')}`;
</script>

<div class="grid h-full gap-6 lg:grid-cols-[1.4fr_1fr]">
	<section aria-live="assertive" class="flex flex-col">
		<h2 class="text-xl text-surface-300">Llamando ahora</h2>
		{#if ultimo}
			{#key ultimo.id}
				<div
					class="llamado mt-4 flex flex-1 flex-col items-center justify-center rounded-container bg-white p-8 text-center text-surface-950"
				>
					<p class="codigo text-[clamp(4rem,14vw,11rem)] leading-none font-bold">{ultimo.codigo}</p>
					<p class="mt-6 text-[clamp(1.5rem,4vw,3rem)] font-bold">{destino(ultimo)}</p>
					<p class="mt-2 text-xl text-surface-700">
						{ultimo.servicio}{ultimo.prioridad ? ' · ★ Prioritario' : ''}
					</p>
				</div>
			{/key}
		{:else}
			<p
				class="mt-4 flex flex-1 items-center justify-center rounded-container border border-dashed border-surface-700 p-8 text-2xl text-surface-300"
			>
				Aún no se ha llamado ningún turno.
			</p>
		{/if}
		{#if anteriores.length}
			<ul class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
				{#each anteriores as t (t.id)}
					<li class="rounded-base border border-surface-700 px-4 py-3">
						<span class="codigo block text-2xl font-bold">{t.codigo}</span>
						<span class="text-sm text-surface-300">{destino(t)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section>
		<h2 class="text-xl text-surface-300">Próximos turnos</h2>
		<ol class="mt-4 flex flex-col gap-2">
			{#each proximos as t (t.id)}
				<li
					class="flex items-center justify-between rounded-base border border-surface-700 px-5 py-3"
				>
					<span class="codigo text-3xl font-bold">{t.codigo}</span>
					<span class="text-right text-sm text-surface-300">
						{t.servicio}{t.prioridad ? ' ★' : ''}<br />~{t.espera_min} min
					</span>
				</li>
			{:else}
				<li class="py-4 text-surface-400">No hay turnos en espera.</li>
			{/each}
		</ol>
	</section>
</div>

<style>
	/* Único movimiento del sistema: destaca el turno recién llamado. */
	.llamado {
		animation: destello 1.6s ease-out;
	}
	@keyframes destello {
		0% {
			background: var(--color-warning-300);
			transform: scale(0.98);
		}
		100% {
			background: #fff;
			transform: scale(1);
		}
	}
</style>
