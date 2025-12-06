// EVENTOS PRODUCIDOS por el Auth
// Este servicio PUBLICA eventos cuando ocurren acciones de autenticación
// Usa EventFactory (Factory Method Pattern) para crear eventos estandarizados

import EventFactory from '../../factories/EventFactory.js';

/**
 * Crea evento de usuario registrado usando Factory Method
 * Patrón Factory Method aplicado
 */
export const UsuarioRegistradoEvent = (userData) => {
  return EventFactory.createUsuarioEvent("UsuarioRegistrado", {
    id: userData.id,
    email: userData.email,
    nombre: userData.nombre,
    metodo: 'email_password'
  });
};

/**
 * Crea evento de usuario logueado usando Factory Method
 * Patrón Factory Method aplicado
 */
export const UsuarioLogueadoEvent = (userData) => {
  return EventFactory.createUsuarioEvent("UsuarioLogueado", {
    id: userData.id,
    email: userData.email,
    nombre: userData.nombre,
    timestamp: userData.timestamp || new Date().toISOString(),
    metodo: 'email_password'
  });
};

/**
 * Crea evento de usuario actualizado usando Factory Method
 * Patrón Factory Method aplicado
 */
export const UsuarioActualizadoEvent = (userData) => {
  return EventFactory.createUsuarioEvent("UsuarioActualizado", {
    id: userData.id,
    email: userData.email,
    nombre: userData.nombre,
    campos_actualizados: userData.campos_actualizados || ['nombre']
  });
};
