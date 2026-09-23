<script lang="ts">
	import type { Canal } from '$lib/tipos';
	import { NOMBRE_CANAL, fechaCorta, hora12 } from '$lib/util';

	interface Props {
		codigo: string;
		canal: Canal;
		tramite: string;
		fecha: string;
		hora: string;
		agencia?: string;
		prioridad?: boolean;
	}

	let { codigo, canal, tramite, fecha, hora, agencia = '', prioridad = false }: Props = $props();
</script>

<!-- Ticket térmico: el elemento que el usuario reconoce del sistema de colas físico. -->
<article class="ticket imprimible" aria-label="Ticket {codigo}">
	<p class="text-center text-sm text-surface-700">Banco de la Nación</p>
	<p class="mt-4 text-center text-sm font-bold">Turno asignado</p>
	<p class="codigo mt-1 text-center text-6xl leading-none font-bold sm:text-7xl">{codigo}</p>
	{#if prioridad}
		<p class="mt-3 text-center text-sm font-bold">★ Atención prioritaria</p>
	{/if}
	<hr class="my-5 border-dashed border-surface-400" />
	<dl class="codigo grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
		<dt>Canal</dt>
		<dd class="font-bold">{NOMBRE_CANAL[canal]}</dd>
		<dt>Trámite</dt>
		<dd>{tramite}</dd>
		<dt>Fecha</dt>
		<dd>{fechaCorta(fecha)}</dd>
		<dt>Hora</dt>
		<dd>{hora12(hora)}</dd>
		{#if agencia}
			<dt>Agencia</dt>
			<dd>{agencia}</dd>
		{/if}
	</dl>
</article>

<style>
	.ticket {
		position: relative;
		background: #fff;
		padding: 1.75rem 1.5rem 2rem;
		margin-bottom: 10px;
		border: 1px solid var(--color-surface-300);
		border-bottom: none;
	}
	/* Borde inferior dentado, como el papel cortado de la tiquetera. */
	.ticket::after {
		content: '';
		position: absolute;
		left: -1px;
		right: -1px;
		bottom: -10px;
		height: 10px;
		background:
			linear-gradient(135deg, #fff 5px, transparent 0) 0 0 / 10px 10px repeat-x,
			linear-gradient(225deg, #fff 5px, transparent 0) 0 0 / 10px 10px repeat-x;
	}
</style>
