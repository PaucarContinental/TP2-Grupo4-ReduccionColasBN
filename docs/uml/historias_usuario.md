# Historias de usuario — Subsistema de Gestión de Citas

Formato: *Como* [rol], *quiero* [acción] *para* [beneficio]. Prioridad MoSCoW simplificada y estimación en puntos de historia (Fibonacci).


## E1 · Portal del cliente

### HU-01 · Identificarme con mi documento
**Como** cliente del banco, **quiero** ingresar solo con mi DNI, CE, pasaporte o PTP **para** no tener que recordar usuario ni contraseña.

- Prioridad: Alta · Puntos: 3
- Criterios de aceptación:
  - DNI de 8 dígitos; si no, mensaje claro
  - Se verifica contra el padrón legado

### HU-02 · Elegir cómo ser atendido
**Como** cliente, **quiero** elegir entre ventanilla o videollamada **para** no ir a la agencia si no es necesario.

- Prioridad: Alta · Puntos: 2
- Criterios de aceptación:
  - Dos tarjetas: Ventanilla / Plataforma
  - Plataforma genera enlace Meet

### HU-03 · Indicar trámite y prioridad
**Como** adulto mayor, gestante o persona con discapacidad, **quiero** marcar atención prioritaria **para** ser atendido primero.

- Prioridad: Alta · Puntos: 3
- Criterios de aceptación:
  - Catálogo de trámites en chips
  - Motivo obligatorio si marca prioridad

### HU-04 · Ver horarios con menos gente
**Como** cliente, **quiero** ver la afluencia estimada de cada franja **para** evitar las horas de mayor congestión.

- Prioridad: Alta · Puntos: 8
- Criterios de aceptación:
  - Modelo Poisson con historial + reservas
  - Horario recomendado preseleccionado

### HU-05 · Dejar datos al operador
**Como** cliente, **quiero** registrar monto aproximado y observación **para** no repetir la información en ventanilla.

- Prioridad: Media · Puntos: 2
- Criterios de aceptación:
  - Campos opcionales
  - Visibles en la ficha del operador

### HU-06 · Recibir mi ticket
**Como** cliente, **quiero** obtener un ticket con número de turno **para** presentarlo o guardarlo.

- Prioridad: Alta · Puntos: 3
- Criterios de aceptación:
  - Código C-### por agencia y día
  - Imprimir / compartir

### HU-07 · Seguir mi turno en tiempo real
**Como** cliente, **quiero** ver mi posición y espera estimada **para** llegar justo a tiempo.

- Prioridad: Alta · Puntos: 5
- Criterios de aceptación:
  - Se actualiza cada 5 s
  - Aviso «turno próximo»

### HU-08 · Cancelar mi cita
**Como** cliente, **quiero** cancelar un turno en espera **para** liberar el cupo para otra persona.

- Prioridad: Media · Puntos: 2
- Criterios de aceptación:
  - Solo turnos propios en espera
  - Pide confirmación

### HU-09 · Ver historial y perfil
**Como** cliente, **quiero** consultar mis citas pasadas y mis datos **para** llevar control de mis trámites.

- Prioridad: Baja · Puntos: 2
- Criterios de aceptación:
  - Historial con estados
  - Documento enmascarado ****231


## E2 · Panel del operador

### HU-10 · Ingresar con credenciales institucionales
**Como** operador de ventanilla, **quiero** iniciar sesión con usuario y contraseña **para** proteger el panel según la normativa SBS.

- Prioridad: Alta · Puntos: 2
- Criterios de aceptación:
  - No usa el DNI del cliente
  - Error claro si falla

### HU-11 · Ver la cola priorizada
**Como** operador, **quiero** ver los turnos de mi agencia, prioritarios primero **para** atender en el orden correcto.

- Prioridad: Alta · Puntos: 5
- Criterios de aceptación:
  - Filtro Presencial / Virtual / Todos
  - Actualización en tiempo real

### HU-12 · Llamar al siguiente turno
**Como** operador, **quiero** llamar al siguiente con un clic **para** agilizar la atención.

- Prioridad: Alta · Puntos: 3
- Criterios de aceptación:
  - Asigna mi ventanilla al turno
  - No permite dos atenciones abiertas

### HU-13 · Ver la ficha de contexto
**Como** operador, **quiero** ver documento, trámite, monto y observación **para** atender sin pedir datos de nuevo.

- Prioridad: Alta · Puntos: 3
- Criterios de aceptación:
  - Muestra verificación con Mainframe/AS400
  - Enlace Meet si es virtual

### HU-14 · Cerrar la atención
**Como** operador, **quiero** finalizar o marcar «no se presentó» **para** liberar la ventanilla.

- Prioridad: Alta · Puntos: 2
- Criterios de aceptación:
  - Registra hora de fin
  - Vuelve a la cola


## E3 · Responsable de agencia

### HU-15 · Ver indicadores del día
**Como** responsable de agencia, **quiero** ver atendidos, espera promedio y cancelados **para** medir el servicio.

- Prioridad: Media · Puntos: 3
- Criterios de aceptación:
  - Se refresca cada 20 s
  - Datos solo de mi agencia

### HU-16 · Gestionar el catálogo
**Como** responsable de agencia, **quiero** editar trámites, horarios y ventanillas activas **para** ajustar la capacidad real.

- Prioridad: Media · Puntos: 5
- Criterios de aceptación:
  - Solo rol admin
  - El modelo usa ventanillas activas

### HU-17 · Exportar reporte de afluencia
**Como** responsable de agencia, **quiero** descargar la afluencia por franja en CSV **para** ajustar el modelo de horarios.

- Prioridad: Media · Puntos: 3
- Criterios de aceptación:
  - Rango de fechas
  - CSV compatible con Excel


## E4 · Sala de espera

### HU-18 · Ver los turnos llamados en pantalla
**Como** cliente en la agencia, **quiero** ver qué turno se llama y a qué ventanilla **para** acercarme sin estar pendiente de un altavoz.

- Prioridad: Media · Puntos: 3
- Criterios de aceptación:
  - Refresco cada 3 s, sin datos personales
  - Destaca el último llamado


**Total: 18 historias · 59 puntos.**
