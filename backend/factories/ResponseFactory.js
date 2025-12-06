class ResponseFactory {
  // Crea una respuesta exitosa (200)
  static success(res, message, data = null, statusCode = 200) {
    const response = {
      success: true,
      message: message
    };

    if (data !== null) {
      response.data = data;
    }

    return res.status(statusCode).json(response);
  }

  // Crea una respuesta de error (400-500)
  static error(res, message, statusCode = 400, errorDetails = null) {
    const response = {
      success: false,
      message: message
    };

    if (errorDetails) {
      response.error = errorDetails;
    }

    return res.status(statusCode).json(response);
  }

  // Crea una respuesta de error de autenticación (401)
  static unauthorized(res, message = 'Token de autorización requerido') {
    return ResponseFactory.error(res, message, 401);
  }

  // Crea una respuesta de error de permisos (403)
  static forbidden(res, message = 'No tienes permisos para realizar esta acción') {
    return ResponseFactory.error(res, message, 403);
  }

  // Crea una respuesta de recurso no encontrado (404)
  static notFound(res, message = 'Recurso no encontrado') {
    return ResponseFactory.error(res, message, 404);
  }

  // Crea una respuesta de conflicto (409)
  static conflict(res, message) {
    return ResponseFactory.error(res, message, 409);
  }

  // Crea una respuesta de error interno del servidor (500)
  static serverError(res, message = 'Error interno del servidor') {
    return ResponseFactory.error(res, message, 500);
  }

  // Crea una respuesta de creado exitosamente (201)
  static created(res, message, data) {
    return ResponseFactory.success(res, message, data, 201);
  }

  // Crea una respuesta de datos sin estructura (para compatibilidad)
  static data(res, data, statusCode = 200) {
    return res.status(statusCode).json(data);
  }
}

export default ResponseFactory;

