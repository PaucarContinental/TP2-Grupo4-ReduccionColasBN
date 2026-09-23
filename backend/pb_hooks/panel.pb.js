/// <reference path="../pb_data/types.d.ts" />
/**
 * Endpoints del panel interno (operador de ventanilla y responsable de agencia).
 *   POST /api/panel/llamar                  -> llama al siguiente turno (o a uno específico)
 *   POST /api/panel/turno/{id}/finalizar    -> cierra la atención (atendido / no_asistio)
 *   GET  /api/panel/indicadores             -> indicadores del día de la agencia
 *   GET  /api/panel/reporte                 -> afluencia por fecha y franja (solo admin)
 *   POST /api/panel/demo                    -> genera turnos de demostración (solo admin)
 */

// ------------------------------------------------------------------ llamar
routerAdd(
  "POST",
  "/api/panel/llamar",
  (e) => {
    const m = require(`${__hooks}/lib/modelo.js`);
    const b = e.requestInfo().body || {};
    const op = e.auth;
    const agencia = op.getString("agencia");
    const ventanilla = op.getString("ventanilla");
    if (!ventanilla) throw new BadRequestError("Tu usuario no tiene una ventanilla asignada. Pide al responsable de agencia que te asigne una.");

    let v;
    try {
      v = $app.findRecordById("ventanillas", ventanilla);
    } catch (_) {
      throw new BadRequestError("La ventanilla asignada no existe.");
    }
    if (!v.getBool("activa")) throw new BadRequestError("Tu ventanilla está desactivada. Actívala desde Administración.");

    const fecha = m.hoy();
    let resultado = null;
    $app.runInTransaction((tx) => {
      // Si el operador ya tiene una atención abierta, se retoma en lugar de llamar a otro turno.
      const abierta = tx.findRecordsByFilter(
        "turnos",
        "operador = {:o} && estado = 'atendiendo'",
        "-llamado_en",
        1,
        0,
        { o: op.id },
      );
      if (abierta.length) {
        resultado = { id: abierta[0].id, codigo: abierta[0].getString("codigo"), retomado: true };
        return;
      }

      let turno = null;
      if (b.id) {
        try {
          turno = tx.findRecordById("turnos", String(b.id));
        } catch (_) {
          throw new NotFoundError("El turno no existe.");
        }
        if (turno.getString("agencia") !== agencia) throw new ForbiddenError("El turno pertenece a otra agencia.");
        if (turno.getString("estado") !== "en_espera") throw new BadRequestError("El turno " + turno.getString("codigo") + " ya no está en espera.");
      } else {
        let filtro = "agencia = {:a} && fecha = {:f} && estado = 'en_espera'";
        const canal = String(b.canal || "");
        if (canal === "ventanilla" || canal === "plataforma") filtro += " && canal = {:c}";
        const lista = tx.findRecordsByFilter("turnos", filtro, "-prioridad,hora,created", 1, 0, { a: agencia, f: fecha, c: canal });
        if (!lista.length) throw new BadRequestError("No hay turnos en espera para el filtro seleccionado.");
        turno = lista[0];
      }

      turno.set("estado", "atendiendo");
      turno.set("ventanilla", ventanilla);
      turno.set("operador", op.id);
      turno.set("llamado_en", new DateTime());
      tx.save(turno);
      resultado = { id: turno.id, codigo: turno.getString("codigo"), retomado: false };
    });

    return e.json(200, resultado);
  },
  $apis.requireAuth("users"),
);

// --------------------------------------------------------------- finalizar
routerAdd(
  "POST",
  "/api/panel/turno/{id}/finalizar",
  (e) => {
    const b = e.requestInfo().body || {};
    const resultado = b.resultado === "no_asistio" ? "no_asistio" : "atendido";
    let turno;
    try {
      turno = $app.findRecordById("turnos", e.request.pathValue("id"));
    } catch (_) {
      throw new NotFoundError("El turno no existe.");
    }
    if (turno.getString("agencia") !== e.auth.getString("agencia")) throw new ForbiddenError("El turno pertenece a otra agencia.");
    if (turno.getString("estado") !== "atendiendo") throw new BadRequestError("El turno no está en atención.");
    turno.set("estado", resultado);
    turno.set("finalizado_en", new DateTime());
    $app.save(turno);
    return e.json(200, { id: turno.id, estado: resultado });
  },
  $apis.requireAuth("users"),
);

// ------------------------------------------------------------- indicadores
routerAdd(
  "GET",
  "/api/panel/indicadores",
  (e) => {
    const m = require(`${__hooks}/lib/modelo.js`);
    const agencia = e.auth.getString("agencia");
    const fecha = m.hoy();
    const turnos = $app.findRecordsByFilter("turnos", "agencia = {:a} && fecha = {:f}", "", 0, 0, { a: agencia, f: fecha });

    const cuenta = { en_espera: 0, atendiendo: 0, atendido: 0, cancelado: 0, no_asistio: 0 };
    let sumaEspera = 0;
    let nEspera = 0;
    let sumaAtencion = 0;
    let nAtencion = 0;
    for (const t of turnos) {
      cuenta[t.getString("estado")] = (cuenta[t.getString("estado")] || 0) + 1;
      const llamado = m.msDeCampo(t.getString("llamado_en"));
      if (!isNaN(llamado)) {
        const programado = m.instantePeru(t.getString("fecha"), t.getString("hora"));
        const creado = m.msDeCampo(t.getString("created"));
        const referencia = Math.max(programado, isNaN(creado) ? programado : creado);
        sumaEspera += Math.max(0, (llamado - referencia) / 60000);
        nEspera++;
        const fin = m.msDeCampo(t.getString("finalizado_en"));
        if (!isNaN(fin)) {
          sumaAtencion += Math.max(0, (fin - llamado) / 60000);
          nAtencion++;
        }
      }
    }

    return e.json(200, {
      fecha: fecha,
      total: turnos.length,
      en_espera: cuenta.en_espera,
      atendiendo: cuenta.atendiendo,
      atendidos: cuenta.atendido,
      cancelados: cuenta.cancelado,
      no_asistio: cuenta.no_asistio,
      prom_espera_min: nEspera ? Math.round(sumaEspera / nEspera) : 0,
      prom_atencion_min: nAtencion ? Math.round(sumaAtencion / nAtencion) : 0,
    });
  },
  $apis.requireAuth("users"),
);

// ----------------------------------------------------------------- reporte
routerAdd(
  "GET",
  "/api/panel/reporte",
  (e) => {
    const m = require(`${__hooks}/lib/modelo.js`);
    if (e.auth.getString("rol") !== "admin") throw new ForbiddenError("Solo el responsable de agencia puede exportar reportes.");
    const q = e.request.url.query();
    const hasta = q.get("hasta") || m.hoy();
    const desde = q.get("desde") || m.sumarDias(hasta, -29);
    if (!m.fechaValida(desde) || !m.fechaValida(hasta) || desde > hasta) throw new BadRequestError("El rango de fechas no es válido.");

    const agencia = e.auth.getString("agencia");
    const servicios = {};
    for (const s of $app.findRecordsByFilter("servicios", "id != ''", "", 0, 0)) servicios[s.id] = s.getString("nombre");

    const turnos = $app.findRecordsByFilter(
      "turnos",
      "agencia = {:a} && fecha >= {:d} && fecha <= {:h}",
      "fecha,hora",
      0,
      0,
      { a: agencia, d: desde, h: hasta },
    );
    const filas = {};
    for (const t of turnos) {
      const clave = [t.getString("fecha"), t.getString("hora"), t.getString("servicio"), t.getString("canal")].join("|");
      if (!filas[clave]) {
        filas[clave] = {
          fecha: t.getString("fecha"),
          franja: t.getString("hora"),
          tramite: servicios[t.getString("servicio")] || "",
          canal: t.getString("canal"),
          total: 0,
          atendidos: 0,
          cancelados: 0,
          no_asistio: 0,
          prioritarios: 0,
        };
      }
      const f = filas[clave];
      f.total++;
      if (t.getString("estado") === "atendido") f.atendidos++;
      if (t.getString("estado") === "cancelado") f.cancelados++;
      if (t.getString("estado") === "no_asistio") f.no_asistio++;
      if (t.getBool("prioridad")) f.prioritarios++;
    }
    const lista = Object.keys(filas).map((k) => filas[k]);
    return e.json(200, { agencia: agencia, desde: desde, hasta: hasta, filas: lista });
  },
  $apis.requireAuth("users"),
);

// ----------------------------------------------------- datos de demostración
routerAdd(
  "POST",
  "/api/panel/demo",
  (e) => {
    const m = require(`${__hooks}/lib/modelo.js`);
    if (e.auth.getString("rol") !== "admin") throw new ForbiddenError("Solo el responsable de agencia puede generar datos de demostración.");
    const agencia = e.auth.getString("agencia");
    const fecha = m.hoy();
    const ag = $app.findRecordById("agencias", agencia);
    const franjas = m.franjasDelDia(ag, fecha);
    if (!franjas.length) throw new BadRequestError("Hoy la agencia no atiende; no se pueden generar turnos de demostración.");

    const ahora = m.horaActual();
    const futuras = franjas.filter((f) => f > ahora);
    const base = futuras.length ? futuras : franjas;

    const servicios = $app.findRecordsByFilter("servicios", "activo = true", "orden", 0, 0);
    const padron = $app.findRecordsByFilter("padron_legado", "id != ''", "", 0, 0);
    if (!servicios.length || !padron.length) throw new BadRequestError("Faltan catálogos para generar la demostración.");

    const creados = [];
    $app.runInTransaction((tx) => {
      const colClientes = tx.findCollectionByNameOrId("clientes");
      for (let i = 0; i < Math.min(6, padron.length); i++) {
        const p = padron[i];
        let c;
        try {
          c = tx.findFirstRecordByFilter("clientes", "tipo_documento = {:t} && numero_documento = {:n}", {
            t: p.getString("tipo_documento"),
            n: p.getString("numero_documento"),
          });
        } catch (_) {
          c = new Record(colClientes);
          c.set("tipo_documento", p.getString("tipo_documento"));
          c.set("numero_documento", p.getString("numero_documento"));
          c.set("email", p.getString("tipo_documento").toLowerCase() + "." + p.getString("numero_documento").toLowerCase() + "@clientes.colasbn.local");
          c.setPassword($security.randomString(32));
        }
        c.set("nombres", p.getString("nombres"));
        c.set("verificado_legado", true);
        tx.save(c);

        const pensionista = p.getBool("es_pensionista");
        const srv = pensionista ? servicios.filter((s) => s.getString("nombre") === "Cobro de pensión")[0] || servicios[0] : servicios[i % servicios.length];
        const t = m.crearTurno(tx, {
          agencia: agencia,
          servicio: srv.id,
          cliente: c.id,
          canal: i % 3 === 1 ? "plataforma" : "ventanilla",
          prioridad: pensionista,
          tipo_prioridad: pensionista ? "adulto_mayor" : "",
          fecha: fecha,
          hora: base[Math.min(i >> 1, base.length - 1)],
          monto_aprox: srv.getString("nombre") === "Retiro de CTS" ? 3500 : 0,
          observacion: i === 0 ? "Primera solicitud, sin cuenta CTS previa" : "",
        });
        creados.push(t.getString("codigo"));
      }
    });
    return e.json(200, { creados: creados });
  },
  $apis.requireAuth("users"),
);
