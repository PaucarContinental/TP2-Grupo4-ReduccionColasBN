# Casos de prueba ejecutables (muestra de la matriz de 42 casos, Guía Práctica 03)

| ID | Módulo | Nivel | Cómo probarlo en el sistema | Resultado esperado | Estado |
|---|---|---|---|---|---|
| CP-01 | Autenticación | Unitario | En `/` ingresar DNI `71234231` | Acceso concedido; va a Mis citas o a Nueva cita | ✔ Verificado |
| CP-02 | Autenticación | Unitario | En `/` ingresar DNI `1234567` | Mensaje «El DNI debe tener exactamente 8 dígitos.» | ✔ Verificado |
| CP-07 | Solicitud de cita | Integración | Elegir trámite y el horario recomendado, «Generar ticket» | Ticket `C-###` creado; la franja descuenta un cupo | ✔ Verificado |
| CP-15 | Motor de horarios | Unitario | Consultar un lunes entre 09:00 y 10:00 en Cusco | Franja marcada como «Mucha gente»; se recomienda otra franja | ✔ Verificado |
| CP-22 | Accesibilidad | Sistema | Completar el flujo de cita sin asistencia | Cita completada en 3 pantallas, texto de 18 px y foco visible | ✔ Verificado |
| CP-30 | Integración legado | Integración | Operador abre la ficha de un cliente del padrón | «✔ Verificado en Mainframe/AS400» | ✔ Verificado (padrón simulado) |
| CP-38 | Notificaciones | Sistema | Cliente con turno en posición 1–2 en `/mis-citas` | Aviso «Turno próximo» en menos de 5 s (refresco automático) | ✔ Verificado |
| CP-42 | Carga y estrés | Sistema | 200 solicitudes simultáneas a `/api/citas/cola/{agencia}` | El servicio no cae; respuesta < 3 s | Pendiente de ejecutar con k6/ab |

Validaciones adicionales implementadas en el servidor:

- No se puede reservar dos veces el mismo trámite activo en la misma fecha.
- No se puede reservar una franja pasada, llena, fuera del horario o en domingo.
- Un operador no puede llamar otro turno si tiene una atención abierta (se le devuelve la ficha abierta).
- Un operador solo ve y atiende turnos de su propia agencia.
- Los clientes solo pueden leer sus propios turnos; la cola pública no expone datos personales.
