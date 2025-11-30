import { supabase } from "../../shared/supabase/client.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";


const tripTable = "Viaje";
const stationTable = "Estacion";

/* ===================== ENUMS ===================== */

export const tipoEstacion = {
  METRO: 'METRO',
  BICICLETA: 'BICICLETA',
};

export const tipoRecorrido = {
  MILLA: 'MILLA',
  LARGO: 'LARGO',
  ERROR: 'ERROR'
};

export const ESTADO_PAGO = {
  PENDIENTE: 'PENDIENTE',
  PAGADO: 'PAGADO',
  CANCELADO: 'CANCELADO',
  FALLIDO: 'FALLIDO',
  SUSCRITO: 'SUSCRITO'
};

export const ESTADO_VIAJE = {
  INICIADO: 'iniciado',
  FINALIZADO: 'finalizado',
  POR_FINALIZAR: 'por_finalizar'
};

/* ===================== HANDLER ===================== */

class TripHandler {

  async finalizarViaje(tripId) {

    const fechaFinalizacion = new Date()

    const { data: trip, error: tripError } = await supabase
      .from(tripTable)
      .select(`
        id,
        fechacomienzo,
        estacionFin,
        estacionInicio,
        estadoPago,
        tipo_viaje,
        estado_viaje,
        idReserva,
        impuesto
      `)
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      console.error("Error Supabase:", tripError);
      throw new Error("Viaje no encontrado");
    }

    if (trip.estado_viaje === ESTADO_VIAJE.FINALIZADO) {
      throw new Error("Este viaje ya fue finalizado");
    }

    /* === CÁLCULO COSTO === */
    const costo = this.calcularCostoViaje(
      trip.fechacomienzo,
      fechaFinalizacion,
      trip.estadoPago,
      trip.tipo_viaje,
      trip.impuesto
    );


    /* === DISTANCIA === */
    const distancia = await this.calcularDistancia(trip.estacionInicio, trip.estacionFin);



    /* === UPDATE === */
    const { data: viajeActualizado, error } = await supabase
      .from(tripTable)
      .update({
        precioSubtotal: costo.subtotal,
        tiempoExtra: costo.tiempoExtra,
        estado_viaje: ESTADO_VIAJE.FINALIZADO,
        tiempoViaje: costo.minutosUso,
        precioTotal: costo.total,
        distanciaRecorrida: distancia,
        fechafin: fechaFinalizacion.toISOString(),
        estadoPago: costo.estadoPago,
        impuesto: costo.impuesto
      })
      .eq("id", tripId)
      .select()
      .single();

    if (error || !viajeActualizado) {
      console.error("Error Supabase:", error);
      throw new Error("No se pudo actualizar el viaje");
    }

    // ACTUALIZAR ESTACIÓN DE FINALIZACIÓN (INCREMENTAR)
    if (trip.estacionFin) {
      await this.actualizarContadorEstacion(trip.estacionFin, 'incrementar');
    }

    /* === EVENTO DE PAGO === */
    if (viajeActualizado.estadoPago !== ESTADO_PAGO.SUSCRITO) {
      await eventBus.publish(CHANNELS.PAGOS, {
        type: "viaje_finalizado",
        data: {
          viajeId: viajeActualizado.id,
          reservaId: viajeActualizado.idReserva,
          totalPagar: viajeActualizado.precioTotal,
          estadoPago: viajeActualizado.estadoPago,
          minutosUso: viajeActualizado.tiempoViaje,
          distanciaKm: viajeActualizado.distanciaRecorrida
        }
      });
    }

    return viajeActualizado;
  }

  /* ================= DISTANCIA ================= */

  async calcularDistancia(estacionInicio, estacionFin) {

    const [inicio, fin] = await Promise.all([
      this.consultaEstacionPosicion(estacionInicio),
      this.consultaEstacionPosicion(estacionFin)
    ]);

    const coords = [inicio.latitud, inicio.longitud, fin.latitud, fin.longitud];
    if (coords.some(v => typeof v !== "number" || isNaN(v))) {
      throw new Error("Coordenadas inválidas");
    }

    const R = 6371;
    const toRad = deg => deg * Math.PI / 180;

    const dLat = toRad(fin.latitud - inicio.latitud);
    const dLon = toRad(fin.longitud - inicio.longitud);

    const lat1 = toRad(inicio.latitud);
    const lat2 = toRad(fin.latitud);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

    return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(3));
  }

  async consultaEstacionPosicion(estacionId) {

    const { data, error } = await supabase
      .from("Estacion")
      .select("posicion")
      .eq("id", estacionId)
      .single();

    if (error || !data?.posicion) {
      throw new Error(`No se pudo obtener posición estación ${estacionId}`);
    }

    return {
      latitud: Number(data.posicion.latitud),
      longitud: Number(data.posicion.longitud)
    };
  }

  /* ================= COSTO ================= */

  calcularCostoViaje(fechaComienzo, fechaFinalizacion, estadoActual, tipoViaje, impuestoViaje) {

    const inicio = new Date(fechaComienzo);
    const fin = new Date(fechaFinalizacion);

    if (isNaN(inicio) || isNaN(fin)) {
      throw new Error("Fechas inválidas");
    }

    const minutos = Math.ceil((fin - inicio) / 60000);

    if (estadoActual === ESTADO_PAGO.SUSCRITO) {
      return {
        total: 0,
        minutosUso: minutos,
        estadoPago: ESTADO_PAGO.SUSCRITO,
        precioSubtotal: 0,
        tiempoExtra: 0
      };
    }

    const { subtotal,
      tiempoExtra,
      impuesto,
      total } = this.calcularTarifa(tipoViaje, minutos, impuestoViaje);

    return {
      subtotal,
      tiempoExtra,
      impuesto,
      total,
      minutosUso: minutos,
      estadoPago: ESTADO_PAGO.PENDIENTE
    };
  }

  calcularTarifa(tipo, minutos, impuestoViaje) {

    const TARIFAS = {
      MILLA: { base: 17500, max: 45, extra: 250 },
      LARGO: { base: 25000, max: 75, extra: 1000 }
    };
    const tarifa = TARIFAS[tipo];
    if (!tarifa) throw new Error("Tipo de recorrido inválido");

    let tiempoExtra = 0;

    if (minutos > tarifa.max) {
      const minutosExtra = minutos - tarifa.max;
      tiempoExtra = minutosExtra * tarifa.extra;
    }

    const subtotal = tarifa.base + tiempoExtra;

    const impuesto = subtotal * impuestoViaje;
    const total = subtotal + impuesto;

    return {
      subtotal,
      tiempoExtra,
      impuesto,
      total
    };
  }


  async changeStatus(tripId, status) {


    const { data, error } = await supabase
      .from(tripTable)
      .update({ estadoPago: status })
      .eq("id", tripId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error actualizando estado: ${error.message}`);
    }


    console.log(`✅ Estado actualizado: ${data.estadoPago} -> ${status}`);
    return data;
  }


  /* ================= UTILIDAD ================= */

  async verificarViaje(viajeId, suscripcion, estacionFin) {

    const { data: viaje, error } = await supabase
      .from(tripTable)
      .select('*')
      .eq('id', viajeId)
      .single();

    if (error) {
      console.error('❌ Error verificando viaje:', error);
      throw new Error('Error verificando viaje');
    }

    // Verificar el tipo de viaje
    const tipoViaje = this.verificarTipoViaje(viaje.estacionInicio.tipoEstacion, viaje.estacionFin.tipoEstacion);

    if (tipoViaje === estadoPago.ERROR) {
      return "Tipo de viaje no válido, intente nuevamente más tarde";
    }

    // Verificar estado del pago según suscripción
    const estado = this.verificarSuscripcion(suscripcion);

    // Actualizar tipo de viaje y estado de pago
    await this.modificarTipoyEstadoViaje(viajeId, tipoViaje, estado);

    return viaje;
  }
  verificarTipoViaje(inicio, fin) {
    if (inicio === tipoEstacion.METRO || fin === tipoEstacion.METRO) {
      return tipoRecorrido.MILLA;
    }
    return tipoRecorrido.LARGO;
  }


  verificarSuscripcion(suscripcion) {

    if (!suscripcion) return estadoPago.PENDIENTE;

    const { estado, viajes_disponibles } = suscripcion;

    // Suscripción activa con viajes disponibles
    if (estado === 'activo' && viajes_disponibles > 0) {
      return estadoPago.SUSCRITO;
    }

    // Suscripción activa sin viajes disponibles
    if (estado === 'activo' && viajes_disponibles === 0) {
      return estadoPago.PENDIENTE;
    }

    // Suscripción no activa
    return estadoPago.PENDIENTE;
  }


  async modificarTipoyEstadoViaje(viajeId, tipoViaje, estado) {
    try {

      const { error } = await supabase
        .from(tripTable)
        .update({
          tipo_viaje: tipoViaje,
          estadoPago: estado
        })
        .eq('id', viajeId);

      if (error) {
        console.error('❌ Error modificando viaje:', error);
      }

    } catch (err) {
      console.error('❌ Error consulta BD:', err);
    }
  }




  async obtenerViajes() {
    const { data, error } = await supabase.from(tripTable).select("*");
    if (error) throw new Error("Error obteniendo viajes");
    return data;

  }

  // Actualiza el contador de bicicletas en una estación
  async actualizarContadorEstacion(estacionId, operacion) {
    try {
      const { data: estacion, error } = await supabase
        .from(stationTable)
        .select('cantidadBicicletas')
        .eq('id', estacionId)
        .single();

      if (error) throw error;

      const nuevaCantidad = operacion === 'incrementar' 
        ? estacion.cantidadBicicletas + 1 
        : estacion.cantidadBicicletas - 1;

      const { error: updateError } = await supabase
        .from(stationTable)
        .update({ cantidadBicicletas: nuevaCantidad })
        .eq('id', estacionId);

      if (updateError) throw updateError;

      // Verificar si la estación quedó vacía
      if (nuevaCantidad === 0 && operacion === 'decrementar') {
        await this.verificarEstacionVacia(estacionId);
      }

      return nuevaCantidad;
    } catch (error) {
      console.error('Error actualizando contador estación:', error);
      throw error;
    }
  }

  async verificarEstacionVacia(estacionId) {
    try {
      // Publicar evento para redistribución
      await eventBus.publish(CHANNELS.ESTACIONES, {
        type: "estacion_vacia",
        data: {
          estacionId: estacionId,
          timestamp: new Date().toISOString(),
          tipo: "redistribucion_automatica"
        }
      });

      console.log(`🚨 Estación ${estacionId} quedó vacía - Disparando redistribución`);
    } catch (error) {
      console.error('Error en verificarEstacionVacia:', error);
    }
  }


}

export const tripHandler = new TripHandler();
