import PocketBase from 'pocketbase';

/**
 * Cliente PocketBase.
 * - En desarrollo, Vite redirige /api a http://127.0.0.1:8090 (ver vite.config.ts).
 * - En producción, PocketBase sirve el frontend desde pb_public, así que el origen es el mismo.
 */
export const pb = new PocketBase('/');

// Varias vistas consultan en paralelo; evitamos que el SDK cancele peticiones repetidas.
pb.autoCancellation(false);
