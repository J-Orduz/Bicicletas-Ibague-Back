// EVENTOS PRODUCIDOS por el Auth
// Este servicio PUBLICA eventos cuando ocurren acciones de autenticación

export const UsuarioRegistradoEvent = (userData) => ({
  type: "UsuarioRegistrado",
  data: {
    id: userData.id,
    email: userData.email,
    nombre: userData.nombre,
    timestamp: new Date().toISOString(),
    metodo: 'email_password'
  }
});

// Evento para login
export const UsuarioLogueadoEvent = (userData) => ({
  type: "UsuarioLogueado",
  data: {
    id: userData.id,
    email: userData.email,
    nombre: userData.nombre,
    timestamp: userData.timestamp,
    metodo: 'email_password'
  }
});

// Evento para actualización de perfil
export const UsuarioActualizadoEvent = (userData) => ({
  type: "UsuarioActualizado",
  data: {
    id: userData.id,
    email: userData.email,
    nombre: userData.nombre,
    timestamp: new Date().toISOString(),
    campos_actualizados: userData.campos_actualizados || ['nombre']
  }
});
