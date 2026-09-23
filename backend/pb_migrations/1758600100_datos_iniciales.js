/// <reference path="../pb_data/types.d.ts" />
/**
 * Migración 2 — Datos iniciales (catálogos, personal, padrón simulado y afluencia histórica).
 * Contraseña inicial de todo el personal: Colas2026!  (cambiarla antes de producción)
 */

migrate(
  (app) => {
    const guardar = (coleccion, datos) => {
      const record = new Record(app.findCollectionByNameOrId(coleccion));
      for (const k in datos) record.set(k, datos[k]);
      app.save(record);
      return record;
    };

    // ------------------------------------------------------------ superusuario
    const superusers = app.findCollectionByNameOrId("_superusers");
    const su = new Record(superusers);
    su.set("email", "admin@colasbn.local");
    su.setPassword("AdminColasBN2026");
    app.save(su);

    // ---------------------------------------------------------------- agencias
    const agencias = {
      cusco: guardar("agencias", { nombre: "Agencia Cusco Centro", region: "sur", direccion: "Av. El Sol, Cusco", hora_apertura: "08:30", hora_cierre: "17:30", activa: true }),
      arequipa: guardar("agencias", { nombre: "Agencia Arequipa Centro", region: "sur", direccion: "Calle Mercaderes, Arequipa", hora_apertura: "08:30", hora_cierre: "17:30", activa: true }),
      huancayo: guardar("agencias", { nombre: "Agencia Huancayo", region: "centro", direccion: "Calle Real, Huancayo", hora_apertura: "08:30", hora_cierre: "17:00", activa: true }),
    };

    // ------------------------------------------------------------- ventanillas
    const ventanillas = {};
    const nVent = { cusco: 4, arequipa: 3, huancayo: 3 };
    for (const clave in nVent) {
      for (let n = 1; n <= nVent[clave]; n++) {
        ventanillas[clave + n] = guardar("ventanillas", { agencia: agencias[clave].id, numero: n, activa: true });
      }
    }

    // --------------------------------------------------------------- servicios
    const servicios = [
      ["Retiro de CTS", 12, 1],
      ["Apertura de cuenta", 15, 2],
      ["Cobro de pensión", 6, 3],
      ["Reclamo", 10, 4],
      ["Otro trámite", 8, 5],
    ];
    for (const s of servicios) {
      guardar("servicios", { nombre: s[0], duracion_min: s[1], orden: s[2], activo: true });
    }

    // ------------------------------------------------------- personal (users)
    const personal = [
      { usuario: "operador1", name: "Carmen Villena", email: "operador1@colasbn.local", rol: "operador", agencia: agencias.cusco.id, ventanilla: ventanillas.cusco3.id },
      { usuario: "operador2", name: "Julio Ccori", email: "operador2@colasbn.local", rol: "operador", agencia: agencias.cusco.id, ventanilla: ventanillas.cusco1.id },
      { usuario: "admin.cusco", name: "Responsable de Agencia Cusco", email: "admin.cusco@colasbn.local", rol: "admin", agencia: agencias.cusco.id, ventanilla: ventanillas.cusco4.id },
      { usuario: "operador.arequipa", name: "Milagros Zúñiga", email: "operador.arequipa@colasbn.local", rol: "operador", agencia: agencias.arequipa.id, ventanilla: ventanillas.arequipa1.id },
    ];
    const usersCol = app.findCollectionByNameOrId("users");
    for (const p of personal) {
      const r = new Record(usersCol);
      for (const k in p) r.set(k, p[k]);
      r.set("verified", true);
      r.setPassword("Colas2026!");
      app.save(r);
    }

    // ------------------------------- padrón legado (simulación del Mainframe/AS400)
    const padron = [
      ["DNI", "71234231", "Juan Pérez Rojas", true, false],
      ["DNI", "45120087", "Rosa Quispe Mamani", false, true],
      ["DNI", "72981134", "Marco Fernández Soto", true, false],
      ["DNI", "40317752", "Lucía Huamán Ccori", false, false],
      ["DNI", "23984410", "Teodoro Condori Apaza", false, true],
      ["CE", "001234567", "Carlos Méndez Rivas", false, false],
      ["PASAPORTE", "AB123456", "Anna Keller", false, false],
      ["PTP", "123456789", "Daniela Rondón Pérez", false, false],
    ];
    for (const p of padron) {
      guardar("padron_legado", { tipo_documento: p[0], numero_documento: p[1], nombres: p[2], tiene_cts: p[3], es_pensionista: p[4] });
    }

    // ------------------------------------------- afluencia histórica por franja
    // Llegadas promedio por franja de 30 min (día base), obtenidas del sistema de colas físico.
    const curva = {
      "08:30": 8, "09:00": 12, "09:30": 13, "10:00": 11, "10:30": 9, "11:00": 8,
      "11:30": 7, "12:00": 8, "12:30": 9, "13:00": 7, "13:30": 6, "14:00": 5,
      "14:30": 5, "15:00": 6, "15:30": 7, "16:00": 6, "16:30": 5, "17:00": 3,
    };
    const factorDia = { 1: 1.15, 2: 1.0, 3: 0.95, 4: 0.95, 5: 1.1, 6: 0.85 };
    const factorAgencia = { cusco: 1.0, arequipa: 0.9, huancayo: 0.7 };
    const afCol = app.findCollectionByNameOrId("afluencia_historica");
    for (const clave in agencias) {
      for (let dia = 1; dia <= 6; dia++) {
        for (const franja in curva) {
          if (dia === 6 && (franja < "09:00" || franja >= "13:00")) continue; // sábado 09:00–13:00
          const r = new Record(afCol);
          r.set("agencia", agencias[clave].id);
          r.set("dia_semana", dia);
          r.set("franja", franja);
          r.set("promedio_llegadas", Math.round(curva[franja] * factorDia[dia] * factorAgencia[clave] * 10) / 10);
          app.save(r);
        }
      }
    }
  },
  (app) => {
    for (const nombre of ["afluencia_historica", "padron_legado", "users", "servicios", "ventanillas", "agencias"]) {
      const records = app.findAllRecords(nombre);
      for (const r of records) app.delete(r);
    }
    try {
      app.delete(app.findAuthRecordByEmail("_superusers", "admin@colasbn.local"));
    } catch (_) {}
  },
);
