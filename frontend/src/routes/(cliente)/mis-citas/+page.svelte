<script lang="ts">
	import { onMount } from 'svelte';
	import EstadoTurno from '$lib/components/EstadoTurno.svelte';
	import TablaCola from '$lib/components/TablaCola.svelte';
	import { pb } from '$lib/pocketbase';
	import { sesion } from '$lib/stores/sesion.svelte';
	import type { ItemCola, RespuestaCola, Turno } from '$lib/tipos';
	import {
		NOMBRE_CANAL,
		NOMBRE_DOCUMENTO,
		enmascarar,
		fechaCorta,
		fechaLarga,
		hora12,
		hoyPeru,
		mensajeError,
		minutosHasta
	} from '$lib/util';

	// Figura 2.4 — Seguimiento del turno en tiempo real.
	type Vista = 'citas' | 'historial' | 'notificaciones' | 'perfil';
	const MENU: { id: Vista; nombre: string }[] = [
		{ id: 'citas', nombre: 'Mis citas' },
		{ id: 'historial', nombre: 'Historial' },
		{ id: 'notificaciones', nombre: 'Notificaciones' },
		{ id: 'perfil', nombre: 'Mi perfil' }
	];
	const REFRESCO_MS = 5000;

	let vista = $state<Vista>('citas');
	let turnos = $state<Turno[]>([]);
	let colas = $state<Record<string, RespuestaCola>>({});
	let cargando = $state(true);
	let error = $state('');
	let cancelando = $state('');
	let reloj = $state(Date.now());

	const hoy = $derived.by(() => {
		void reloj;
		return hoyPeru();
	});
	const activos = $derived(
		turnos
			.filter((t) => t.fecha >= hoy && (t.estado === 'en_espera' || t.estado === 'atendiendo'))
			.sort((a, b) => (a.fecha + a.hora < b.fecha + b.hora ? -1 : 1))
	);
	const deHoy = $derived(activos.filter((t) => t.fecha === hoy));
	const proximos = $derived(activos.filter((t) => t.fecha > hoy));
	const historial = $derived(turnos.filter((t) => !activos.includes(t)));
	const idsPropios = $derived(turnos.map((t) => t.id));

	function itemCola(t: Turno): ItemCola | undefined {
		return colas[t.agencia]?.turnos.find((c) => c.id === t.id);
	}

	/** Avisos derivados del estado de la cola, como «turno próximo». */
	const notificaciones = $derived.by(() => {
		void reloj;
		const lista: { id: string; texto: string; urgente: boolean }[] = [];
		for (const t of deHoy) {
			const item = itemCola(t);
			const srv = t.expand?.servicio?.nombre ?? 'tu trámite';
			if (t.estado === 'atendiendo') {
				lista.push({
					id: `${t.id}-llamado`,
					urgente: true,
					texto:
						t.canal === 'plataforma'
							? `Es tu turno ${t.codigo}: únete ahora a la videollamada.`
							: `Es tu turno ${t.codigo}: acércate a la ventanilla ${item?.ventanilla ?? t.expand?.ventanilla?.numero ?? ''}.`
				});
				continue;
			}
			const faltan = minutosHasta(t.fecha, t.hora);
			if (t.canal === 'plataforma' && faltan <= 5 && faltan >= 0) {
				lista.push({
					id: `${t.id}-meet`,
					urgente: true,
					texto: `La videollamada de ${t.codigo} empieza en ${faltan} min.`
				});
			}
			if (item && item.posicion <= 2) {
				lista.push({
					id: `${t.id}-proximo`,
					urgente: true,
					texto:
						item.posicion === 1
							? `Turno próximo: eres el siguiente (${t.codigo}).`
							: `Turno próximo: hay 1 persona antes que tú (${t.codigo}).`
				});
			} else if (item) {
				lista.push({
					id: `${t.id}-cola`,
					urgente: false,
					texto: `${t.codigo} (${srv}): hay ${item.posicion - 1} personas antes que tú, espera aproximada de ${item.espera_min} min.`
				});
			}
		}
		for (const t of proximos) {
			lista.push({
				id: `${t.id}-futuro`,
				urgente: false,
				texto: `Tienes una cita el ${fechaLarga(t.fecha)} a las ${hora12(t.hora)} (${t.codigo}).`
			});
		}
		return lista;
	});

	async function cargar() {
		try {
			turnos = await pb.collection('turnos').getFullList<Turno>({
				sort: '-fecha,-hora',
				expand: 'servicio,agencia,ventanilla'
			});
			const agencias = [...new Set(deHoy.map((t) => t.agencia))];
			const respuestas = await Promise.all(
				agencias.map((a) => pb.send<RespuestaCola>(`/api/citas/cola/${a}`, {}))
			);
			const mapa: Record<string, RespuestaCola> = {};
			respuestas.forEach((r) => (mapa[r.agencia] = r));
			colas = mapa;
			error = '';
		} catch (err) {
			error = mensajeError(err);
		} finally {
			cargando = false;
			reloj = Date.now();
		}
	}

	onMount(() => {
		cargar();
		const intervalo = setInterval(cargar, REFRESCO_MS);
		return () => clearInterval(intervalo);
	});

	async function cancelar(t: Turno) {
		if (
			!confirm(`¿Cancelar el turno ${t.codigo} del ${fechaCorta(t.fecha)} a las ${hora12(t.hora)}?`)
		)
			return;
		cancelando = t.id;
		try {
			await pb.send(`/api/citas/turno/${t.id}/cancelar`, { method: 'POST' });
			await cargar();
		} catch (err) {
			error = mensajeError(err);
		} finally {
			cancelando = '';
		}
	}
</script>

<svelte:head>
	<title>Mis citas · Banco de la Nación</title>
</svelte:head>

<div class="mx-auto grid max-w-6xl gap-6 px-5 py-8 md:grid-cols-[13rem_1fr]">
	<nav aria-label="Menú de mis citas" class="panel h-fit p-3">
		<p class="px-2 pb-2 text-sm font-bold text-surface-700">Menú</p>
		<ul class="flex flex-row flex-wrap gap-1 md:flex-col">
			{#each MENU as m (m.id)}
				<li>
					<button
						type="button"
						class="w-full rounded-base px-3 py-2 text-left {vista === m.id
							? 'bg-surface-950 font-bold text-surface-50'
							: 'hover:bg-surface-100'}"
						aria-current={vista === m.id ? 'page' : undefined}
						onclick={() => (vista = m.id)}
					>
						{m.nombre}
						{#if m.id === 'notificaciones' && notificaciones.some((n) => n.urgente)}
							<span
								class="ml-1 inline-block size-2 rounded-full bg-warning-500"
								aria-label="hay avisos nuevos"
							></span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	</nav>

	<main class="min-w-0">
		{#if error}
			<p class="error-caja mb-4" role="alert">{error}</p>
		{/if}

		{#if cargando}
			<p class="text-surface-700">Cargando tus citas…</p>
		{:else if vista === 'citas'}
			<h1 class="text-xl font-bold">Estado de tu turno en tiempo real</h1>

			{#if deHoy.length === 0}
				<p class="mt-2 text-surface-800">
					{proximos.length
						? 'Hoy no tienes turnos. Tus próximas citas están abajo.'
						: 'Aún no tienes citas activas.'}
				</p>
			{/if}

			{#each Object.values(colas) as cola (cola.agencia)}
				{@const nombre = deHoy.find((t) => t.agencia === cola.agencia)?.expand?.agencia?.nombre}
				<p class="mt-4 mb-2 text-sm text-surface-700">{nombre} · se actualiza cada 5 segundos</p>
				<TablaCola turnos={cola.turnos} propios={idsPropios} />
			{/each}

			{#if notificaciones.length}
				<section class="mt-8" aria-labelledby="t-notif" aria-live="polite">
					<h2 id="t-notif" class="text-lg font-bold">Notificaciones</h2>
					<ul class="mt-3 flex flex-col gap-2">
						{#each notificaciones.slice(0, 3) as n (n.id)}
							<li class={n.urgente ? 'nota font-bold' : 'panel px-4 py-3 text-sm'}>{n.texto}</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if activos.length}
				<section class="mt-8" aria-labelledby="t-activas">
					<h2 id="t-activas" class="text-lg font-bold">Tus citas activas</h2>
					<ul class="mt-3 flex flex-col gap-3">
						{#each activos as t (t.id)}
							<li class="panel flex flex-wrap items-center justify-between gap-3 p-4">
								<div>
									<p>
										<span class="codigo font-bold">{t.codigo}</span> · {t.expand?.servicio?.nombre}
									</p>
									<p class="text-sm text-surface-800 first-letter:uppercase">
										{fechaLarga(t.fecha)}, {hora12(t.hora)} · {NOMBRE_CANAL[t.canal]} · {t.expand
											?.agencia?.nombre}
									</p>
								</div>
								<div class="flex flex-wrap items-center gap-2">
									<EstadoTurno estado={t.estado} />
									<a class="btn-secundario min-h-10 text-sm" href="/ticket/{t.id}">Ver ticket</a>
									{#if t.estado === 'en_espera'}
										<button
											type="button"
											class="btn min-h-10 text-sm font-bold text-error-700 hover:bg-error-50"
											disabled={cancelando === t.id}
											onclick={() => cancelar(t)}
										>
											{cancelando === t.id ? 'Cancelando…' : 'Cancelar'}
										</button>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<a href="/nueva-cita" class="btn-principal mt-8">+ Solicitar nueva cita</a>
		{:else if vista === 'historial'}
			<h1 class="text-xl font-bold">Historial</h1>
			{#if historial.length === 0}
				<p class="mt-2 text-surface-800">
					Aquí aparecerán tus citas atendidas, canceladas o pasadas.
				</p>
			{:else}
				<div class="panel mt-4 overflow-x-auto">
					<table class="tabla">
						<thead>
							<tr><th>Turno</th><th>Trámite</th><th>Fecha</th><th>Canal</th><th>Estado</th></tr>
						</thead>
						<tbody>
							{#each historial as t (t.id)}
								<tr>
									<td class="codigo">{t.codigo}</td>
									<td>{t.expand?.servicio?.nombre}</td>
									<td>{fechaCorta(t.fecha)} {hora12(t.hora)}</td>
									<td>{NOMBRE_CANAL[t.canal]}</td>
									<td><EstadoTurno estado={t.estado} /></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{:else if vista === 'notificaciones'}
			<h1 class="text-xl font-bold">Notificaciones</h1>
			{#if notificaciones.length === 0}
				<p class="mt-2 text-surface-800">
					No tienes avisos. Te avisaremos aquí cuando tu turno esté cerca.
				</p>
			{:else}
				<ul class="mt-4 flex flex-col gap-2" aria-live="polite">
					{#each notificaciones as n (n.id)}
						<li class={n.urgente ? 'nota font-bold' : 'panel px-4 py-3 text-sm'}>{n.texto}</li>
					{/each}
				</ul>
			{/if}
		{:else if sesion.cliente}
			<h1 class="text-xl font-bold">Mi perfil</h1>
			<dl class="panel mt-4 grid max-w-lg grid-cols-[auto_1fr] gap-x-6 gap-y-3 p-5">
				<dt class="text-surface-700">Documento</dt>
				<dd>
					{NOMBRE_DOCUMENTO[sesion.cliente.tipo_documento]}
					{enmascarar(sesion.cliente.numero_documento)}
				</dd>
				<dt class="text-surface-700">Nombre</dt>
				<dd>{sesion.cliente.nombres || 'No registrado'}</dd>
				<dt class="text-surface-700">Verificación</dt>
				<dd>
					{sesion.cliente.verificado_legado
						? '✔ Verificado con los registros del banco'
						: 'Pendiente: se validará en agencia con tu documento físico'}
				</dd>
			</dl>
		{/if}
	</main>
</div>
