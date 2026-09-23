/// <reference path="../pb_data/types.d.ts" />
/**
 * Endpoints del usuario (cliente del banco).
 *   POST /api/citas/identificar           -> identifica por documento (sin contraseña) y devuelve token
 *   GET  /api/citas/horarios              -> franjas sugeridas por el modelo de afluencia
 *   POST /api/citas/turno                 -> genera el ticket / cita
 *   POST /api/citas/turno/{id}/cancelar   -> cancela un turno propio en espera
 *   GET  /api/citas/cola/{agencia}        -> cola pública del día (sin datos personales)
 */

// ------------------------------------------------------------ identificar
routerAdd("POST", "/api/citas/identificar", (e) => {
  const m = require(`${__hooks}/lib/modelo.js`);
  const body = e.requestInfo().body || {};
  const tipo = String(body.tipo_documento || "");
  const numero = m.normalizarDocumento(body.numero_documento);

  const error = m.validarDocumento(tipo, numero);
  if (error) throw new BadRequestError(error);

  // Validación contra el sistema legado (simulado con la colección padron_legado).
  let legado = null;
  try {
    legado = $app.findFirstRecordByFilter("padron_legado", "tipo_documento = {:t} && numero_documento = {:n}", { t: tipo, n: numero });
  } catch (_) {
    legado = null;
  }

  let cliente;
  try {
    cliente = $app.findFirstRecordByFilter("clientes", "tipo_documento = {:t} && numero_documento = {:n}", { t: tipo, n: numero });
  } catch (_) {
    cliente = new Record($app.findCollectionByNameOrId("clientes"));
    cliente.set("tipo_documento", tipo);
    cliente.set("numero_documento", numero);
    cliente.set("email", tipo.toLowerCase() + "." + numero.toLowerCase() + "@clientes.colasbn.local");
    cliente.setPassword($security.randomString(32));
  }
  cliente.set("verificado_legado", !!legado);
  if (legado) cliente.set("nombres", legado.getString("nombres"));
  $app.save(cliente);

  return $apis.recordAuthResponse(e, cliente, "documento", null);
});

// --------------------------------------------------------------- horarios
routerAdd(
  "GET",
  "/api/citas/horarios",
  (e) => {
    const m = require(`${__hooks}/lib/modelo.js`);
    const q = e.request.url.query();
    const agencia = q.get("agencia");
    const fecha = q.get("fecha") || m.hoy();
    if (!agencia) throw new BadRequestError("Selecciona una agencia.");
    if (!m.fechaValida(fecha)) throw new BadRequestError("La fecha no es válida.");
    if (fecha < m.hoy() || fecha > m.sumarDias(m.hoy(), m.MAX_DIAS_ANTICIPACION)) {
      throw new BadRequestError("Solo puedes reservar desde hoy hasta 14 días después.");
    }
    try {
      $app.findRecordById("agencias", agencia);
    } catch (_) {
      throw new NotFoundError("La agencia no existe.");
    }
    return e.json(200, m.calcularHorarios($app, agencia, fecha));
  },
  $apis.requireAuth("clientes"),
);

// ----------------------------------------------------------- crear turno
routerAdd(
  "POST",
  "/api/citas/turno",
  (e) => {
    const m = require(`${__hooks}/lib/modelo.js`);
    const b = e.requestInfo().body || {};
    const agencia = String(b.agencia || "");
    const servicio = String(b.servicio || "");
    const canal = String(b.canal || "");
    const fecha = String(b.fecha || "");
    const hora = String(b.hora || "");
    const prioridad = b.prioridad === true;
    const tipoPrioridad = String(b.tipo_prioridad || "");
    const monto = Number(b.monto_aprox || 0);
    const observacion = String(b.observacion || "").trim().slice(0, 300);

    if (canal !== "ventanilla" && canal !== "plataforma") throw new BadRequestError("Elige cómo deseas ser atendido.");
    if (!m.fechaValida(fecha)) throw new BadRequestError("La fecha no es válida.");
    if (fecha < m.hoy() || fecha > m.sumarDias(m.hoy(), m.MAX_DIAS_ANTICIPACION)) {
      throw new BadRequestError("Solo puedes reservar desde hoy hasta 14 días después.");
    }
    if (prioridad && ["adulto_mayor", "gestante", "discapacidad"].indexOf(tipoPrioridad) === -1) {
      throw new BadRequestError("Indica el motivo de la atención prioritaria.");
    }
    if (isNaN(monto) || monto < 0 || monto > 1000000) throw new BadRequestError("El monto aproximado no es válido.");

    let srv;
    try {
      srv = $app.findRecordById("servicios", servicio);
    } catch (_) {
      throw new BadRequestError("Selecciona un tipo de trámite.");
    }
    if (!srv.getBool("activo")) throw new BadRequestError("Ese trámite no está disponible por ahora.");
    try {
      $app.findRecordById("agencias", agencia);
    } catch (_) {
      throw new BadRequestError("Selecciona una agencia.");
    }

    const clienteId = e.auth.id;
    let creado = null;
    $app.runInTransaction((tx) => {
      const horarios = m.calcularHorarios(tx, agencia, fecha);
      const franja = horarios.franjas.filter((f) => f.hora === hora)[0];
      if (!franja) throw new BadRequestError("Ese horario no pertenece al horario de atención de la agencia.");
      if (!franja.disponible) throw new BadRequestError("Ese horario ya no está disponible. Elige otro de los sugeridos.");

      const duplicado = tx.findRecordsByFilter(
        "turnos",
        "cliente = {:c} && fecha = {:f} && servicio = {:s} && (estado = 'en_espera' || estado = 'atendiendo')",
        "",
        1,
        0,
        { c: clienteId, f: fecha, s: servicio },
      );
      if (duplicado.length) {
        throw new BadRequestError("Ya tienes una cita activa para este trámite en esa fecha (" + duplicado[0].getString("codigo") + ").");
      }

      creado = m.crearTurno(tx, {
        agencia: agencia,
        servicio: servicio,
        cliente: clienteId,
        canal: canal,
        prioridad: prioridad,
        tipo_prioridad: tipoPrioridad,
        fecha: fecha,
        hora: hora,
        monto_aprox: monto,
        observacion: observacion,
      });
    });

    return e.json(200, { id: creado.id, codigo: creado.getString("codigo") });
  },
  $apis.requireAuth("clientes"),
);

// -------------------------------------------------------- cancelar turno
routerAdd(
  "POST",
  "/api/citas/turno/{id}/cancelar",
  (e) => {
    const id = e.request.pathValue("id");
    let turno;
    try {
      turno = $app.findRecordById("turnos", id);
    } catch (_) {
      throw new NotFoundError("El turno no existe.");
    }
    if (turno.getString("cliente") !== e.auth.id) throw new ForbiddenError("Este turno no te pertenece.");
    if (turno.getString("estado") !== "en_espera") throw new BadRequestError("Solo puedes cancelar un turno que aún está en espera.");
    turno.set("estado", "cancelado");
    $app.save(turno);
    return e.json(200, { id: turno.id, estado: "cancelado" });
  },
  $apis.requireAuth("clientes"),
);

// ------------------------------------------------------------ cola pública
routerAdd("GET", "/api/citas/cola/{agencia}", (e) => {
  const m = require(`${__hooks}/lib/modelo.js`);
  const agencia = e.request.pathValue("agencia");
  try {
    $app.findRecordById("agencias", agencia);
  } catch (_) {
    throw new NotFoundError("La agencia no existe.");
  }
  return e.json(200, m.construirCola($app, agencia, m.hoy()));
});
