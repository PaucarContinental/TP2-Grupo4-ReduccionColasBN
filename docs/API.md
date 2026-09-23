# API y modelo de datos

## Colecciones (PocketBase)

| Colección | Tipo | Contenido | Acceso |
|---|---|---|---|
| `agencias` | base | nombre, región, dirección, horario de apertura/cierre | lectura pública; edita el admin de la agencia |
| `ventanillas` | base | agencia, número, activa | personal; edita el admin de la agencia |
| `servicios` | base | trámite, duración (min), orden, activo | lectura pública; edita el admin |
| `padron_legado` | base | simulación del Mainframe/AS400 (documento → nombres) | solo servidor |
| `afluencia_historica` | base | llegadas promedio por agencia, día y franja de 30 min | personal |
| `clientes` | auth | tipo y número de documento, nombres, verificado | el propio cliente y el personal |
| `turnos` | base | código, agencia, trámite, cliente, canal, prioridad, fecha, hora, estado, ventanilla, monto, observación, enlace Meet | el cliente dueño y el personal; **se crean y cambian solo desde pb_hooks** |
| `users` | auth | operadores: usuario, nombre, rol (operador/admin), agencia, ventanilla | el propio usuario |

Estados de un turno: `en_espera` → `atendiendo` → `atendido` | `no_asistio`; o `en_espera` → `cancelado`.

## Endpoints propios (`backend/pb_hooks`)

### Cliente

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/citas/identificar` | — | `{tipo_documento, numero_documento}` → valida formato, consulta el padrón y devuelve `{token, record}` |
| GET | `/api/citas/horarios?agencia=&fecha=` | cliente | franjas del día con probabilidad de congestión, nivel, cupos y la recomendada |
| POST | `/api/citas/turno` | cliente | `{agencia, servicio, canal, prioridad, tipo_prioridad, fecha, hora, monto_aprox, observacion}` → `{id, codigo}` |
| POST | `/api/citas/turno/{id}/cancelar` | cliente | cancela un turno propio en espera |
| GET | `/api/citas/cola/{agencia}` | — | cola del día, ordenada, con espera estimada y sin datos personales |

### Panel interno

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/panel/llamar` | personal | `{id?}` o `{canal?}` → pasa el siguiente turno a «atendiendo» en la ventanilla del operador |
| POST | `/api/panel/turno/{id}/finalizar` | personal | `{resultado: "atendido" \| "no_asistio"}` |
| GET | `/api/panel/indicadores` | personal | atendidos, cancelados, en espera, espera y atención promedio del día |
| GET | `/api/panel/reporte?desde=&hasta=` | admin | afluencia por fecha, franja, trámite y canal |
| POST | `/api/panel/demo` | admin | crea 6 turnos de hoy para demostraciones |

## Modelo de sugerencia de horarios

Para cada franja de 30 minutos de la agencia:

- **λ** = llegadas históricas promedio (colección `afluencia_historica`) + citas ya reservadas.
- **Capacidad** = ventanillas activas × 30 min ÷ duración promedio de los trámites.
- **Congestión** = P(X ≥ capacidad), con X ~ Poisson(λ).
- Nivel: `baja` < 0.25 ≤ `media` < 0.60 ≤ `alta`.
- Cada franja reserva la mitad de su capacidad para citas; al llenarse deja de estar disponible.
- La franja disponible con menor congestión se marca como **recomendada** y se preselecciona.

La cola se ordena por prioridad (adulto mayor, gestante, discapacidad), luego por hora de la
cita y por orden de registro. La espera estimada suma la duración de los trámites anteriores y
la divide entre las ventanillas activas.

Todas las fechas y horas de negocio usan la hora de Perú (UTC−5), sin importar la zona horaria
del servidor.
