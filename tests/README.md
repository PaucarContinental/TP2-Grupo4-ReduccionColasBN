# Pruebas — Mocha + Chai (Guía Práctica 07)

77 pruebas automatizadas, repartidas entre los cuatro integrantes:

| Archivo | Responsable | Tipo | Pruebas |
|---|---|---|---|
| `unit/luis-modelo-backend.test.mjs` | Luis Alberto Tecsi Huallpa | Unitarias (motor de horarios, turnos, cola) | 22 |
| `unit/gabriel-utilidades-frontend.test.ts` | Rye Gabriel Gregory Paucar Quejia | Unitarias (utilidades de la interfaz) | 17 |
| `integracion/salome-seguridad.test.mjs` | Salome Celeste Ccahua Huamani | Unitarias + integración (seguridad y permisos) | 17 |
| `integracion/nelson-flujos-funcionales.test.mjs` | Nelson Paucara Huillca | Integración (flujos de la matriz CP-xx) | 21 |

## Cómo ejecutarlas

```bash
npm install          # en la raíz del proyecto (una sola vez)
npm test             # todas las pruebas
npm run test:unit    # solo unitarias (no necesitan servidor)
npm run test:integracion
npm run test:reporte # genera tests/reporte/reporte-pruebas.html
```

Las pruebas de integración levantan un PocketBase **temporal** con las migraciones y hooks
del proyecto, en una carpeta temporal que se borra al terminar. Nunca tocan `backend/pb_data`.
Requieren el binario `backend/pocketbase` (Linux) o `backend/pocketbase.exe` (Windows).

En VS Code, la extensión **Mocha Test Explorer** (recomendada en `.vscode/extensions.json`)
muestra las pruebas en el panel *Testing* con la barra verde.

## Apoyo

- `apoyo/servidor.mjs`: arranca y detiene el servidor temporal en un puerto libre.
- `apoyo/datos.mjs`: inicia sesión como cliente, operador o superusuario y prepara turnos.
- `apoyo/app-simulada.mjs`: doble de prueba (mock) de PocketBase para las pruebas unitarias del backend.
