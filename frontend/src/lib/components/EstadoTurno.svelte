<script lang="ts">
	import type { EstadoTurno } from '$lib/tipos';
	import { NOMBRE_ESTADO } from '$lib/util';

	let { estado }: { estado: EstadoTurno } = $props();

	const estilos: Record<EstadoTurno, string> = {
		en_espera: 'border-surface-400 text-surface-800',
		atendiendo: 'border-surface-900 bg-surface-900 text-surface-50',
		atendido: 'border-success-600 text-success-800',
		cancelado: 'border-surface-300 text-surface-600 line-through',
		no_asistio: 'border-error-400 text-error-800'
	};
</script>

<span class="inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold {estilos[estado]}">
	{NOMBRE_ESTADO[estado]}
</span>
