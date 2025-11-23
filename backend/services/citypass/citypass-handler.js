// services/citypass/citypass-handler.js
import { supabase } from "../../shared/supabase/client.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

const cityPassTable = "CityPass";

export const CityPassStatus = {
  ACTIVA: 'activa',
  INACTIVA: 'inactiva', 
  BLOQUEADA: 'bloqueada'
};

class CityPassHandler {
  constructor() {}

  // Validar formato del número de tarjeta (1010 + 4 dígitos)
  validarFormatoTarjeta(cardNumber) {
    const regex = /^1010\d{4}$/;
    if (!regex.test(cardNumber)) {
      throw new Error('Formato de tarjeta inválido. Debe ser 1010 seguido de 4 dígitos (ej: 10101234)');
    }
    return true;
  }

  // Verificar si el número de tarjeta ya existe
  async verificarTarjetaExistente(cardNumber) {
    const { data: existe, error } = await supabase
      .from(cityPassTable)
      .select('card_number')
      .eq('card_number', cardNumber)
      .single();
    
    if (error?.code === 'PGRST116') { // No encontrado = disponible
      return false;
    }
    
    if (error) throw error;
    
    return true; // Ya existe
  }

  // Generar saldo random entre 70,000 y 200,000
  generarSaldoRandom() {
    return Math.floor(70000 + Math.random() * 130001); // 70000 - 200000
  }

  // Vincular tarjeta CityPass a usuario
  async vincularTarjeta(usuarioId, cardNumber) {
    try {
      console.log(`💳 Solicitando vincular CityPass para usuario: ${usuarioId}, Tarjeta: ${cardNumber}`);
      
      // Verificar si ya tiene tarjeta vinculada
      const tarjetaExistente = await this.obtenerTarjetaPorUsuario(usuarioId);
      if (tarjetaExistente) {
        throw new Error('Ya tienes una tarjeta CityPass vinculada');
      }

      // Validar formato de tarjeta
      this.validarFormatoTarjeta(cardNumber);

      // Verificar si la tarjeta ya está en uso
      const tarjetaEnUso = await this.verificarTarjetaExistente(cardNumber);
      if (tarjetaEnUso) {
        throw new Error('El número de tarjeta ya está en uso');
      }

      const saldoInicial = this.generarSaldoRandom();

      console.log(`🆕 Vinculando tarjeta: ${cardNumber} con saldo: $${saldoInicial}`);

      // Crear registro en la base de datos
      const { data: nuevaTarjeta, error } = await supabase
        .from(cityPassTable)
        .insert({
          user_id: usuarioId,
          card_number: cardNumber,
          saldo: saldoInicial,
          estado: CityPassStatus.ACTIVA
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Error al vincular tarjeta: ${error.message}`);
      }

      // Publicar evento
      await eventBus.publish(CHANNELS.PAGOS, {
        type: "citypass_vinculada",
        data: {
          userId: usuarioId,
          cardNumber: cardNumber,
          saldoInicial: saldoInicial,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`✅ Tarjeta CityPass vinculada exitosamente: ${cardNumber}`);
      
      return {
        success: true,
        tarjeta: nuevaTarjeta,
        mensaje: 'Tarjeta CityPass vinculada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error vinculando tarjeta CityPass:', error.message);
      throw error;
    }
  }

  // Obtener tarjeta del usuario
  async obtenerTarjetaPorUsuario(usuarioId) {
    try {
      const { data: tarjeta, error } = await supabase
        .from(cityPassTable)
        .select('*')
        .eq('user_id', usuarioId)
        .single();

      if (error?.code === 'PGRST116') return null; // No encontrado
      if (error) throw error;

      return tarjeta;
    } catch (error) {
      console.error('❌ Error obteniendo tarjeta:', error);
      throw error;
    }
  }

  // Procesar pago con CityPass
  async procesarPago(usuarioId, monto) {
    try {
      console.log(`💸 Procesando pago CityPass - Usuario: ${usuarioId}, Monto: $${monto}`);
      
      if (monto <= 0) {
        throw new Error('El monto debe ser mayor a cero');
      }

      // Obtener tarjeta del usuario
      const tarjeta = await this.obtenerTarjetaPorUsuario(usuarioId);
      if (!tarjeta) {
        throw new Error('No tienes una tarjeta CityPass vinculada');
      }

      if (tarjeta.estado !== CityPassStatus.ACTIVA) {
        throw new Error('Tu tarjeta CityPass no está activa');
      }

      // Verificar saldo suficiente
      if (tarjeta.saldo < monto) {
        await eventBus.publish(CHANNELS.PAGOS, {
          type: "pago_rechazado",
          data: {
            userId: usuarioId,
            cardNumber: tarjeta.card_number,
            monto: monto,
            saldoActual: tarjeta.saldo,
            motivo: 'saldo_insuficiente',
            timestamp: new Date().toISOString()
          }
        });

        throw new Error('Saldo insuficiente en tu tarjeta CityPass');
      }

      // Actualizar saldo
      const nuevoSaldo = tarjeta.saldo - monto;
      const { data: tarjetaActualizada, error: updateError } = await supabase
        .from(cityPassTable)
        .update({
          saldo: nuevoSaldo,
          fecha_ultimo_uso: new Date().toISOString()
        })
        .eq('id', tarjeta.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Error al procesar pago: ${updateError.message}`);
      }

      // Publicar evento de pago exitoso
      await eventBus.publish(CHANNELS.PAGOS, {
        type: "pago_exitoso",
        data: {
          userId: usuarioId,
          cardNumber: tarjeta.card_number,
          monto: monto,
          saldoAnterior: tarjeta.saldo,
          saldoNuevo: nuevoSaldo,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`✅ Pago procesado exitosamente. Nuevo saldo: $${nuevoSaldo}`);
      
      return {
        success: true,
        tarjeta: tarjetaActualizada,
        montoDescontado: monto,
        saldoAnterior: tarjeta.saldo,
        saldoNuevo: nuevoSaldo,
        mensaje: 'Pago procesado exitosamente'
      };

    } catch (error) {
      console.error('❌ Error procesando pago CityPass:', error.message);
      
      // Publicar evento de pago rechazado
      await eventBus.publish(CHANNELS.PAGOS, {
        type: "pago_rechazado",
        data: {
          userId: usuarioId,
          monto: monto,
          motivo: error.message,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  // Consultar saldo
  async consultarSaldo(usuarioId) {
    try {
      const tarjeta = await this.obtenerTarjetaPorUsuario(usuarioId);
      if (!tarjeta) {
        throw new Error('No tienes una tarjeta CityPass vinculada');
      }

      return {
        success: true,
        tarjeta: {
          card_number: tarjeta.card_number,
          saldo: tarjeta.saldo,
          estado: tarjeta.estado,
          fecha_ultimo_uso: tarjeta.fecha_ultimo_uso
        },
        mensaje: 'Consulta de saldo exitosa'
      };

    } catch (error) {
      console.error('❌ Error consultando saldo:', error.message);
      throw error;
    }
  }
}

export const cityPassHandler = new CityPassHandler();