// EVENTOS PRODUCIDOS por el Auth
// Este servicio PUBLICA eventos cuando ocurren acciones de autenticación

export const UsuarioRegistradoEvent = (userData) => ({
  type: "UsuarioRegistrado",
  data: {
    email: userData.email,
    nombre: userData.nombre,
    timestamp: new Date().toISOString(),
    metodo: 'magic_link'
  }
});
