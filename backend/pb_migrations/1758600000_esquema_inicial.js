/// <reference path="../pb_data/types.d.ts" />
/**
 * Migración 1 — Esquema del Subsistema de Gestión de Citas (Banco de la Nación)
 * Colecciones: agencias, ventanillas, servicios, padron_legado, afluencia_historica,
 *              clientes (auth), turnos y ampliación de users (operadores).
 */

const AUTODATES = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

const ES_PERSONAL = '@request.auth.collectionName = "users"';
const ES_ADMIN = '@request.auth.collectionName = "users" && @request.auth.rol = "admin"';

migrate(
  (app) => {
    // ---------------------------------------------------------------- agencias
    const agencias = new Collection({
      type: "base",
      name: "agencias",
      listRule: "",
      viewRule: "",
      createRule: null,
      updateRule: ES_ADMIN + " && @request.auth.agencia = id",
      deleteRule: null,
      fields: [
        { name: "nombre", type: "text", required: true, max: 120 },
        { name: "region", type: "select", required: true, maxSelect: 1, values: ["sur", "centro", "norte", "oriente", "lima"] },
        { name: "direccion", type: "text", max: 200 },
        { name: "hora_apertura", type: "text", required: true, pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$" },
        { name: "hora_cierre", type: "text", required: true, pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$" },
        { name: "activa", type: "bool" },
        ...AUTODATES,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_agencias_nombre ON agencias (nombre)"],
    });
    app.save(agencias);

    // ------------------------------------------------------------- ventanillas
    const ventanillas = new Collection({
      type: "base",
      name: "ventanillas",
      listRule: ES_PERSONAL,
      viewRule: ES_PERSONAL,
      createRule: null,
      updateRule: ES_ADMIN + " && @request.auth.agencia = agencia",
      deleteRule: null,
      fields: [
        { name: "agencia", type: "relation", required: true, collectionId: agencias.id, maxSelect: 1, cascadeDelete: true },
        { name: "numero", type: "number", required: true, onlyInt: true, min: 1, max: 99 },
        { name: "activa", type: "bool" },
        ...AUTODATES,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_ventanillas_agencia_numero ON ventanillas (agencia, numero)"],
    });
    app.save(ventanillas);

    // --------------------------------------------------------------- servicios
    const servicios = new Collection({
      type: "base",
      name: "servicios",
      listRule: "",
      viewRule: "",
      createRule: ES_ADMIN,
      updateRule: ES_ADMIN,
      deleteRule: null,
      fields: [
        { name: "nombre", type: "text", required: true, max: 80 },
        { name: "duracion_min", type: "number", required: true, onlyInt: true, min: 1, max: 120 },
        { name: "orden", type: "number", onlyInt: true, min: 0, max: 999 },
        { name: "activo", type: "bool" },
        ...AUTODATES,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_servicios_nombre ON servicios (nombre)"],
    });
    app.save(servicios);

    // ------------------------------------------ padron_legado (simula Mainframe/AS400)
    const padron = new Collection({
      type: "base",
      name: "padron_legado",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "tipo_documento", type: "select", required: true, maxSelect: 1, values: ["DNI", "CE", "PASAPORTE", "PTP"] },
        { name: "numero_documento", type: "text", required: true, max: 12 },
        { name: "nombres", type: "text", required: true, max: 120 },
        { name: "tiene_cts", type: "bool" },
        { name: "es_pensionista", type: "bool" },
        ...AUTODATES,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_padron_doc ON padron_legado (tipo_documento, numero_documento)"],
    });
    app.save(padron);

    // ------------------------------------------------------ afluencia_historica
    const afluencia = new Collection({
      type: "base",
      name: "afluencia_historica",
      listRule: ES_PERSONAL,
      viewRule: ES_PERSONAL,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "agencia", type: "relation", required: true, collectionId: agencias.id, maxSelect: 1, cascadeDelete: true },
        { name: "dia_semana", type: "number", required: true, onlyInt: true, min: 1, max: 6 },
        { name: "franja", type: "text", required: true, pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$" },
        { name: "promedio_llegadas", type: "number", required: true, min: 0 },
        ...AUTODATES,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_afluencia_clave ON afluencia_historica (agencia, dia_semana, franja)"],
    });
    app.save(afluencia);

    // ------------------------------------------------------ users (operadores)
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new TextField({ name: "usuario", required: true, min: 3, max: 40, pattern: "^[a-z0-9._-]+$" }));
    users.fields.add(new SelectField({ name: "rol", required: true, maxSelect: 1, values: ["operador", "admin"] }));
    users.fields.add(new RelationField({ name: "agencia", required: true, collectionId: agencias.id, maxSelect: 1 }));
    users.fields.add(new RelationField({ name: "ventanilla", collectionId: ventanillas.id, maxSelect: 1 }));
    users.indexes.push("CREATE UNIQUE INDEX idx_users_usuario ON users (usuario)");
    users.passwordAuth.identityFields = ["usuario", "email"];
    users.createRule = null;
    users.updateRule = null;
    users.deleteRule = null;
    app.save(users);

    // --------------------------------------------------------- clientes (auth)
    const clientes = new Collection({
      type: "auth",
      name: "clientes",
      listRule: "id = @request.auth.id || " + ES_PERSONAL,
      viewRule: "id = @request.auth.id || " + ES_PERSONAL,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      passwordAuth: { enabled: false },
      fields: [
        { name: "tipo_documento", type: "select", required: true, maxSelect: 1, values: ["DNI", "CE", "PASAPORTE", "PTP"] },
        { name: "numero_documento", type: "text", required: true, max: 12 },
        { name: "nombres", type: "text", max: 120 },
        { name: "verificado_legado", type: "bool" },
        ...AUTODATES,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_clientes_doc ON clientes (tipo_documento, numero_documento)"],
    });
    app.save(clientes);

    // ------------------------------------------------------------------ turnos
    const turnos = new Collection({
      type: "base",
      name: "turnos",
      listRule: ES_PERSONAL + " || cliente = @request.auth.id",
      viewRule: ES_PERSONAL + " || cliente = @request.auth.id",
      // La creación y los cambios de estado se hacen solo desde pb_hooks.
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "codigo", type: "text", required: true, max: 10 },
        { name: "agencia", type: "relation", required: true, collectionId: agencias.id, maxSelect: 1 },
        { name: "servicio", type: "relation", required: true, collectionId: servicios.id, maxSelect: 1 },
        { name: "cliente", type: "relation", required: true, collectionId: clientes.id, maxSelect: 1 },
        { name: "canal", type: "select", required: true, maxSelect: 1, values: ["ventanilla", "plataforma"] },
        { name: "prioridad", type: "bool" },
        { name: "tipo_prioridad", type: "select", maxSelect: 1, values: ["adulto_mayor", "gestante", "discapacidad"] },
        { name: "fecha", type: "text", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        { name: "hora", type: "text", required: true, pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$" },
        { name: "estado", type: "select", required: true, maxSelect: 1, values: ["en_espera", "atendiendo", "atendido", "cancelado", "no_asistio"] },
        { name: "ventanilla", type: "relation", collectionId: ventanillas.id, maxSelect: 1 },
        { name: "operador", type: "relation", collectionId: users.id, maxSelect: 1 },
        { name: "monto_aprox", type: "number", min: 0, max: 1000000 },
        { name: "observacion", type: "text", max: 300 },
        { name: "enlace_meet", type: "url" },
        { name: "llamado_en", type: "date" },
        { name: "finalizado_en", type: "date" },
        ...AUTODATES,
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_turnos_codigo ON turnos (agencia, fecha, codigo)",
        "CREATE INDEX idx_turnos_cola ON turnos (agencia, fecha, estado)",
        "CREATE INDEX idx_turnos_cliente ON turnos (cliente)",
      ],
    });
    app.save(turnos);
  },
  (app) => {
    for (const nombre of ["turnos", "clientes", "afluencia_historica", "padron_legado", "servicios"]) {
      app.delete(app.findCollectionByNameOrId(nombre));
    }
    const users = app.findCollectionByNameOrId("users");
    for (const campo of ["usuario", "rol", "agencia", "ventanilla"]) {
      users.fields.removeByName(campo);
    }
    users.indexes = users.indexes.filter((i) => i.indexOf("idx_users_usuario") === -1);
    users.passwordAuth.identityFields = ["email"];
    app.save(users);
    app.delete(app.findCollectionByNameOrId("ventanillas"));
    app.delete(app.findCollectionByNameOrId("agencias"));
  },
);
