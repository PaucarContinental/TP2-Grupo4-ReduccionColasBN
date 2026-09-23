/// <reference path="../../pb_data/types.d.ts" />
/**
 * Lógica de negocio compartida por los hooks.
 * IMPORTANTE (JSVM de PocketBase): los handlers no ven variables globales del archivo
 * .pb.js, por eso cada handler hace require() de este módulo.
 */

const DURACION_FRANJA = 30; // minutos
const OFFSET_PERU_MS = -5 * 60 * 60 * 1000; // America/Lima (UTC-5, sin horario de verano)
const MAX_DIAS_ANTICIPACION = 14;

// ------------------------------------------------------------------ fechas
function ahoraPeru() {
  // Devuelve un Date cuyos campos UTC representan la hora local de Perú.
  return new Date(Date.now() + OFFSET_PERU_MS);
}

function hoy() {
  return ahoraPeru().toISOString().slice(0, 10);
}

function horaActual() {
  return ahoraPeru().toISOString().slice(11, 16);
}

function fechaValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) return false;
  const d = new Date(fecha + "T12:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

function diaSemana(fecha) {
  // 0 = domingo … 6 = sábado
  return new Date(fecha + "T12:00:00Z").getUTCDay();
}

function sumarDias(fecha, dias) {
  const d = new Date(fecha + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function aMinutos(hhmm) {
  const p = String(hhmm).split(":");
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

function aHora(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
}

/** Instante UTC (ms) de una fecha + hora local de Perú. */
function instantePeru(fecha, hora) {
  return Date.parse(fecha + "T" + hora + ":00Z") - OFFSET_PERU_MS;
}

/** Convierte el valor de un campo date de PocketBase ("2026-09-23 15:04:05.000Z") a ms. */
function msDeCampo(valor) {
  const s = String(valor || "").trim();
  if (!s) return NaN;
  return Date.parse(s.replace(" ", "T"));
}

/** Franjas de atención (inicio de cada bloque de 30 min) para una agencia y fecha. */
function franjasDelDia(agencia, fecha) {
  const dia = diaSemana(fecha);
  if (dia === 0) return []; // domingo sin atención
  let apertura = aMinutos(agencia.getString("hora_apertura"));
  let cierre = aMinutos(agencia.getString("hora_cierre"));
  if (dia === 6) {
    apertura = Math.max(apertura, aMinutos("09:00"));
    cierre = Math.min(cierre, aMinutos("13:00"));
  }
  const franjas = [];
  for (let m = apertura; m + DURACION_FRANJA <= cierre; m += DURACION_FRANJA) {
    franjas.push(aHora(m));
  }
  return franjas;
}

// ------------------------------------------------------------- documentos
const REGLAS_DOCUMENTO = {
  DNI: { regex: /^\d{8}$/, mensaje: "El DNI debe tener exactamente 8 dígitos." },
  CE: { regex: /^\d{9}$/, mensaje: "El carné de extranjería debe tener 9 dígitos." },
  PTP: { regex: /^\d{9}$/, mensaje: "El PTP debe tener 9 dígitos." },
  PASAPORTE: { regex: /^[A-Z0-9]{6,12}$/, mensaje: "El pasaporte debe tener entre 6 y 12 letras o números." },
};

function normalizarDocumento(numero) {
  return String(numero || "").replace(/\s+/g, "").toUpperCase();
}

/** Devuelve un mensaje de error o "" si el documento es válido. */
function validarDocumento(tipo, numero) {
  const regla = REGLAS_DOCUMENTO[tipo];
  if (!regla) return "Selecciona un tipo de documento válido.";
  if (!regla.regex.test(numero)) return regla.mensaje;
  if (/^(\d)\1+$/.test(numero)) return "El número de documento no es válido.";
  return "";
}

// ----------------------------------------------- modelo de probabilidad (Poisson)
/** P(X >= k) para X ~ Poisson(lambda). */
function probPoissonAlMenos(lambda, k) {
  if (k <= 0) return 1;
  if (lambda <= 0) return 0;
  let termino = Math.exp(-lambda);
  let acumulado = termino;
  for (let i = 1; i < k; i++) {
    termino = (termino * lambda) / i;
    acumulado += termino;
  }
  return Math.max(0, Math.min(1, 1 - acumulado));
}

function nivelCongestion(p) {
  if (p < 0.25) return "baja";
  if (p < 0.6) return "media";
  return "alta";
}

function ventanillasActivas(app, agenciaId) {
  return app.findRecordsByFilter("ventanillas", "agencia = {:a} && activa = true", "numero", 0, 0, { a: agenciaId });
}

function duracionPromedio(app) {
  const servicios = app.findRecordsByFilter("servicios", "activo = true", "", 0, 0);
  if (!servicios.length) return 10;
  let total = 0;
  for (const s of servicios) total += s.getInt("duracion_min");
  return total / servicios.length;
}

/**
 * Evalúa la afluencia proyectada de cada franja y sugiere las de menor congestión.
 * λ(franja) = llegadas históricas promedio + citas ya reservadas en la franja.
 * Capacidad(franja) = ventanillas activas × 30 min / duración promedio del trámite.
 * Congestión = P(X ≥ capacidad), X ~ Poisson(λ).
 */
function calcularHorarios(app, agenciaId, fecha) {
  const agencia = app.findRecordById("agencias", agenciaId);
  if (!agencia.getBool("activa")) throw new BadRequestError("La agencia seleccionada no está atendiendo.");

  const franjas = franjasDelDia(agencia, fecha);
  const nVent = ventanillasActivas(app, agenciaId).length;
  const durProm = duracionPromedio(app);
  const capacidad = Math.max(1, Math.floor((nVent * DURACION_FRANJA) / durProm));
  const cupoCitas = Math.max(1, Math.floor(capacidad / 2)); // la mitad de la capacidad se reserva para citas

  const historico = {};
  const dia = diaSemana(fecha);
  if (dia >= 1 && dia <= 6) {
    const filas = app.findRecordsByFilter("afluencia_historica", "agencia = {:a} && dia_semana = {:d}", "", 0, 0, { a: agenciaId, d: dia });
    for (const f of filas) historico[f.getString("franja")] = f.getFloat("promedio_llegadas");
  }

  const reservas = {};
  const turnos = app.findRecordsByFilter("turnos", "agencia = {:a} && fecha = {:f} && estado != 'cancelado'", "", 0, 0, { a: agenciaId, f: fecha });
  for (const t of turnos) {
    const h = t.getString("hora");
    reservas[h] = (reservas[h] || 0) + 1;
  }

  const esHoy = fecha === hoy();
  const ahora = horaActual();
  const resultado = [];
  for (const franja of franjas) {
    const reservadas = reservas[franja] || 0;
    const lambda = (historico[franja] || 0) + reservadas;
    const prob = nVent === 0 ? 1 : probPoissonAlMenos(lambda, capacidad);
    const pasada = esHoy && franja <= ahora;
    resultado.push({
      hora: franja,
      probabilidad: Math.round(prob * 1000) / 1000,
      nivel: nivelCongestion(prob),
      reservadas: reservadas,
      cupos_libres: Math.max(0, cupoCitas - reservadas),
      disponible: !pasada && nVent > 0 && reservadas < cupoCitas,
      recomendado: false,
    });
  }

  const disponibles = resultado.filter((r) => r.disponible);
  disponibles.sort((a, b) => a.probabilidad - b.probabilidad || (a.hora < b.hora ? -1 : 1));
  if (disponibles.length) disponibles[0].recomendado = true;

  return {
    agencia: agenciaId,
    fecha: fecha,
    ventanillas_activas: nVent,
    capacidad_por_franja: capacidad,
    franjas: resultado,
    sugeridas: disponibles.slice(0, 3).map((r) => r.hora),
  };
}

// ------------------------------------------------------------------ turnos
function enlaceMeet() {
  const abc = "abcdefghijklmnopqrstuvwxyz";
  return (
    "https://meet.google.com/" +
    $security.randomStringWithAlphabet(3, abc) + "-" +
    $security.randomStringWithAlphabet(4, abc) + "-" +
    $security.randomStringWithAlphabet(3, abc)
  );
}

function siguienteCodigo(app, agenciaId, fecha) {
  const existentes = app.findRecordsByFilter("turnos", "agencia = {:a} && fecha = {:f}", "", 0, 0, { a: agenciaId, f: fecha });
  let mayor = 0;
  for (const t of existentes) {
    const n = parseInt(t.getString("codigo").replace(/\D/g, ""), 10);
    if (n > mayor) mayor = n;
  }
  const sig = String(mayor + 1);
  return "C-" + (sig.length < 3 ? "000".slice(sig.length) + sig : sig);
}

/**
 * Crea un turno. `datos`: {agencia, servicio, cliente, canal, prioridad, tipo_prioridad,
 * fecha, hora, monto_aprox, observacion}. Debe ejecutarse dentro de una transacción.
 */
function crearTurno(app, datos) {
  const col = app.findCollectionByNameOrId("turnos");
  const t = new Record(col);
  t.set("codigo", siguienteCodigo(app, datos.agencia, datos.fecha));
  t.set("agencia", datos.agencia);
  t.set("servicio", datos.servicio);
  t.set("cliente", datos.cliente);
  t.set("canal", datos.canal);
  t.set("prioridad", !!datos.prioridad);
  t.set("tipo_prioridad", datos.prioridad ? datos.tipo_prioridad || "" : "");
  t.set("fecha", datos.fecha);
  t.set("hora", datos.hora);
  t.set("estado", "en_espera");
  t.set("monto_aprox", datos.monto_aprox || 0);
  t.set("observacion", datos.observacion || "");
  t.set("enlace_meet", datos.canal === "plataforma" ? enlaceMeet() : "");
  app.save(t);
  return t;
}

/** Cola del día de una agencia, ordenada y con espera estimada. Sin datos personales. */
function construirCola(app, agenciaId, fecha) {
  const servicios = {};
  for (const s of app.findRecordsByFilter("servicios", "id != ''", "", 0, 0)) {
    servicios[s.id] = { nombre: s.getString("nombre"), duracion: s.getInt("duracion_min") };
  }
  const ventanillas = {};
  for (const v of app.findRecordsByFilter("ventanillas", "agencia = {:a}", "", 0, 0, { a: agenciaId })) {
    ventanillas[v.id] = v.getInt("numero");
  }
  const nVent = Math.max(1, ventanillasActivas(app, agenciaId).length);

  const activos = app.findRecordsByFilter(
    "turnos",
    "agencia = {:a} && fecha = {:f} && (estado = 'en_espera' || estado = 'atendiendo')",
    "-prioridad,hora,created",
    0,
    0,
    { a: agenciaId, f: fecha },
  );

  const atendiendo = [];
  const espera = [];
  for (const t of activos) (t.getString("estado") === "atendiendo" ? atendiendo : espera).push(t);

  const salida = [];
  const mapear = (t, posicion, esperaMin) => {
    const srv = servicios[t.getString("servicio")] || { nombre: "Trámite", duracion: 10 };
    return {
      id: t.id,
      codigo: t.getString("codigo"),
      servicio: srv.nombre,
      canal: t.getString("canal"),
      estado: t.getString("estado"),
      prioridad: t.getBool("prioridad"),
      hora: t.getString("hora"),
      ventanilla: ventanillas[t.getString("ventanilla")] || null,
      llamado_en: t.getString("llamado_en"),
      posicion: posicion,
      espera_min: esperaMin,
    };
  };

  atendiendo.sort((a, b) => (a.getString("llamado_en") < b.getString("llamado_en") ? -1 : 1));
  for (const t of atendiendo) salida.push(mapear(t, 0, 0));

  let acumulado = 0;
  espera.forEach((t, i) => {
    salida.push(mapear(t, i + 1, Math.round(acumulado / nVent)));
    const srv = servicios[t.getString("servicio")];
    acumulado += srv ? srv.duracion : 10;
  });

  return { agencia: agenciaId, fecha: fecha, ventanillas_activas: nVent, turnos: salida };
}

module.exports = {
  MAX_DIAS_ANTICIPACION,
  hoy,
  horaActual,
  fechaValida,
  diaSemana,
  sumarDias,
  instantePeru,
  msDeCampo,
  franjasDelDia,
  normalizarDocumento,
  validarDocumento,
  probPoissonAlMenos,
  calcularHorarios,
  crearTurno,
  construirCola,
};
