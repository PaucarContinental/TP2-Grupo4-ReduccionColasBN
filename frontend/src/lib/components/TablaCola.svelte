<script lang="ts">
	import type { ItemCola } from '$lib/tipos';
	import { NOMBRE_CANAL, NOMBRE_ESTADO } from '$lib/util';

	interface Props {
		turnos: ItemCola[];
		propios?: string[];
	}

	let { turnos, propios = [] }: Props = $props();
</script>

<div class="panel overflow-x-auto">
	<table class="tabla">
		<caption class="sr-only">Turnos activos de la agencia</caption>
		<thead>
			<tr>
				<th scope="col">Turno</th>
				<th scope="col">Trámite</th>
				<th scope="col">Canal</th>
				<th scope="col">Estado</th>
				<th scope="col">Espera</th>
			</tr>
		</thead>
		<tbody>
			{#each turnos as t (t.id)}
				{@const mio = propios.includes(t.id)}
				<tr class={mio ? 'bg-warning-50 font-bold' : ''}>
					<td class="codigo">{t.codigo}{t.prioridad ? ' ★' : ''}</td>
					<td>{t.servicio}</td>
					<td>{NOMBRE_CANAL[t.canal]}</td>
					<td>
						{(mio ? 'Tú · ' : '') +
							(t.estado === 'atendiendo' && t.ventanilla
								? `${NOMBRE_ESTADO[t.estado]} (vent. ${t.ventanilla})`
								: NOMBRE_ESTADO[t.estado])}
					</td>
					<td>{t.estado === 'atendiendo' ? '—' : `~${t.espera_min} min`}</td>
				</tr>
			{:else}
				<tr>
					<td colspan="5" class="py-6 text-center text-surface-700">No hay turnos activos hoy.</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
