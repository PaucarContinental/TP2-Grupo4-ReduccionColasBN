# TP2 · Grupo 4 · Reducción de colas — Banco de la Nación

Subsistema web de **gestión de citas presenciales y por videollamada**. El usuario reserva su
turno con anticipación, el sistema le sugiere la franja con menos afluencia (modelo de
probabilidad de Poisson) y el operador de ventanilla recibe el contexto del trámite antes de
atenderlo.

Universidad Continental · Taller de Proyectos 2 (34028) · Docente: Ing. Nestor Gutierrez Huaman

| Integrante | Rol |
|---|---|
| Luis Alberto Tecsi Huallpa | Líder / administrador del repositorio |
| Rye Gabriel Gregory Paucar Quejia | Frontend (Svelte / Skeleton) |
| Salome Celeste Ccahua Huamani | Backend (PocketBase) |
| Nelson Luis Pauccara Huillca | QA, despliegue y documentación |

## Stack

| Componente | Versión |
|---|---|
| Frontend | SvelteKit 2.70 + Svelte 5 (runes) + Skeleton v3.2 + Tailwind CSS v4.3 |
| Backend | PocketBase 0.40.4 (Go, SQLite, API REST + realtime) |
| Runtime | Node.js 22 LTS + npm |
| Servidor | Debian 12 (PocketBase como servicio systemd) |

## Inicio rápido (sin instalar nada más)

El ZIP ya trae el frontend compilado en `backend/pb_public/` y los binarios de PocketBase.

- **Windows:** doble clic en `iniciar-windows.bat`
- **Linux / Debian:** `./iniciar-linux.sh`

Luego abre **http://127.0.0.1:8090**. La primera vez, PocketBase aplica las migraciones y crea
la base de datos con los datos iniciales (tarda un par de segundos).

## Desarrollo

```bash
# Terminal 1 — backend
cd backend
./pocketbase serve            # Windows: .\pocketbase.exe serve

# Terminal 2 — frontend (Node.js 22)
cd frontend
npm install
npm run dev                   # http://localhost:5173  (redirige /api a :8090)
```

Verificaciones antes de cada Pull Request (todas pasan con 0 errores):

```bash
cd frontend
npm run lint
npm run check
npm run build
```

### Pruebas automatizadas (Mocha + Chai)

```bash
npm install          # en la raíz, una sola vez
npm test             # 77 pruebas unitarias y de integración
npm run test:reporte # reporte HTML en tests/reporte/
```

Detalle por integrante en `tests/README.md`. GitHub Actions las ejecuta en cada push
(`.github/workflows/pruebas.yml`).

Para publicar el frontend en PocketBase: `npm run build` y copiar `frontend/build/*` a
`backend/pb_public/`. Despliegue en Debian: `docs/despliegue/desplegar-debian.sh`.

## Cuentas de prueba

| Tipo | Acceso | Credencial |
|---|---|---|
| Cliente | `/` | DNI `71234231` (Juan Pérez), `45120087` (Rosa Quispe, pensionista), `72981134`, `40317752`, `23984410` · CE `001234567` · Pasaporte `AB123456` · PTP `123456789` |
| Operador (Ventanilla 03, Cusco) | `/ventanilla` | `operador1` / `Colas2026!` |
| Operador (Ventanilla 01, Cusco) | `/ventanilla` | `operador2` / `Colas2026!` |
| Responsable de agencia (admin) | `/ventanilla` → Administración | `admin.cusco` / `Colas2026!` |
| Operador Arequipa | `/ventanilla` | `operador.arequipa` / `Colas2026!` |
| Superusuario PocketBase | `/_/` | `admin@colasbn.local` / `AdminColasBN2026` |

Cualquier documento con formato válido que no esté en el padrón también puede ingresar; queda
marcado como *no verificado* para que el operador lo valide con el documento físico.

> **Cambia todas las contraseñas antes de usar el sistema fuera del entorno académico.**

Para tener una cola con movimiento durante la presentación: entra como `admin.cusco`, ve a
**Administración** y pulsa **Generar turnos de prueba**.

## Pantallas (según los wireframes de la Guía Práctica 03)

| Figura | Ruta | Descripción |
|---|---|---|
| 2.1 | `/` | Login del usuario solo con documento (DNI, CE, Pasaporte, PTP) |
| 2.2 | `/nueva-cita` | Canal (Ventanilla / Plataforma), trámite, prioridad, horario sugerido y confirmación en 3 pasos |
| 2.3 | `/ticket/{id}` | Ticket con número de turno, enlace Meet, imprimir / compartir |
| 2.4 | `/mis-citas` | Seguimiento de la cola en tiempo real, notificaciones, historial y perfil |
| 2.5 | `/ventanilla` | Login del personal con credenciales institucionales |
| 2.6 | `/ventanilla/cola` | Cola priorizada por agencia, filtro por canal, «Llamar siguiente turno» (realtime) |
| 2.7 | `/ventanilla/atencion/{id}` | Ficha de contexto, validación con el sistema legado, finalizar atención |
| 2.8 | `/admin` | Indicadores del día, catálogo de trámites/horarios/ventanillas, reporte CSV |
| — | `/pantalla?agencia={id}` | Monitor de llamados para la sala de espera |

Capturas reales del sistema funcionando en `docs/capturas/`.

## Estructura

```
TP2-Grupo4-ReduccionColasBN/
├── frontend/                  # SvelteKit + Skeleton (SPA, adapter-static)
│   └── src/
│       ├── lib/
│       │   ├── components/    # Ticket, TablaCola, PantallaTurnos, Pasos, ...
│       │   ├── stores/        # sesión y panel (runes .svelte.ts)
│       │   ├── theme/         # tema Skeleton «bn-grafito» (escala de grises)
│       │   └── pocketbase.ts  # cliente PocketBase
│       └── routes/            # (cliente)/, ventanilla/, admin/, pantalla/
├── backend/
│   ├── pb_migrations/         # esquema + datos iniciales (SÍ se versionan)
│   ├── pb_hooks/              # API de negocio en JS (SÍ se versiona)
│   ├── pb_public/             # frontend compilado (NO se versiona)
│   └── pocketbase(.exe)       # binario (NO se versiona)
├── docs/                      # API, casos de prueba, capturas y despliegue
├── .vscode/settings.json
├── .editorconfig
└── .gitignore
```

Más detalle en `docs/API.md` y `docs/CASOS_DE_PRUEBA.md`.
