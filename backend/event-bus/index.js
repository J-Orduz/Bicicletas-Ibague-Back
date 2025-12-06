import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import { Observer, CallbackObserver } from './Observer.js';

// CARGAR variables de entorno PRIMERO
dotenv.config();

/**
 * EventBus Singleton
 * Garantiza una única instancia del EventBus en toda la aplicación
 * Patrón Singleton aplicado
 */
class UpstashEventBus {
  // Variable estática para almacenar la instancia única
  static instance = null;

  constructor() {
    // Si ya existe una instancia, retornarla en lugar de crear una nueva
    if (UpstashEventBus.instance) {
      console.log('⚠️ EventBus ya existe, retornando instancia existente (Singleton)');
      return UpstashEventBus.instance;
    }

    console.log('🔧 Configurando Redis con:');
    console.log('URL:', process.env.UPSTASH_REDIS_REST_URL ? '✅ Presente' : '❌ Faltante');
    console.log('TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ Presente' : '❌ Faltante');
    
    // Verificar que las variables estén presentes
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('❌ Faltan variables de entorno de Upstash Redis');
    }

    // Configurar Redis de Upstash
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    
    // Patrón Observer: Gestión de observadores por canal
    // { channel: Map<observerId, Observer> }
    this.observers = new Map();
    
    // Compatibilidad: Mantener subscribers para código existente
    // { channel: [callbacks] }
    this.subscribers = new Map();
    
    // Contador para IDs únicos de suscripciones
    this.subscriptionIdCounter = 0;
    
    // Guardar la instancia
    UpstashEventBus.instance = this;
    console.log('🚀 Upstash Redis Event-Bus configurado correctamente (Singleton + Observer)');
  }

  /**
   * Método estático para obtener la instancia única (patrón Singleton)
   * @returns {UpstashEventBus} La instancia única del EventBus
   */
  static getInstance() {
    if (!UpstashEventBus.instance) {
      UpstashEventBus.instance = new UpstashEventBus();
    }
    return UpstashEventBus.instance;
  }

  /**
   * Método para resetear la instancia (útil para testing)
   */
  static resetInstance() {
    UpstashEventBus.instance = null;
  }

  // Publicar evento
  async publish(channel, event) {
    try {
      // Upstash Redis no tiene PUB/SUB nativo, simulamos con una lista
      const eventData = {
        ...event,
        _id: Date.now() + Math.random(), // ID único
        _timestamp: new Date().toISOString()
      };
      
      console.log(`📤 Intentando publicar en: ${channel}`, eventData.type);
      
      // Guardar evento en una lista del canal
      await this.redis.lpush(`channel:${channel}`, JSON.stringify(eventData));
      
      console.log(`✅ [${channel}] Evento publicado:`, event.type);
      
      // Notificar a subscribers locales (si los hay)
      this.notifySubscribers(channel, eventData);
      
    } catch (error) {
      console.error('❌ Error publicando evento:', error.message);
    }
  }

  /**
   * Suscribirse a eventos (Patrón Observer)
   * 
   * Soporta dos formas:
   * 1. Con callback (compatibilidad con código existente)
   * 2. Con Observer (nuevo, patrón Observer formal)
   * 
   * @param {string} channel - Canal al que suscribirse
   * @param {Function|Observer} callbackOrObserver - Callback o instancia de Observer
   * @param {string} observerId - ID opcional para la suscripción (auto-generado si no se provee)
   * @returns {string} ID de la suscripción
   */
  subscribe(channel, callbackOrObserver, observerId = null) {
    // Generar ID único si no se provee
    const subscriptionId = observerId || `sub_${++this.subscriptionIdCounter}_${Date.now()}`;
    
    // Inicializar Map de observadores para el canal si no existe
    if (!this.observers.has(channel)) {
      this.observers.set(channel, new Map());
    }
    
    const channelObservers = this.observers.get(channel);
    
    // Determinar si es un Observer o un callback
    if (callbackOrObserver instanceof Observer) {
      // Patrón Observer formal
      channelObservers.set(subscriptionId, callbackOrObserver);
      console.log(`✅ Observer suscrito a: ${channel} (ID: ${subscriptionId})`);
    } else if (typeof callbackOrObserver === 'function') {
      // Compatibilidad: Crear CallbackObserver para mantener compatibilidad
      const callbackObserver = new CallbackObserver(subscriptionId, callbackOrObserver);
      channelObservers.set(subscriptionId, callbackObserver);
      
      // Mantener compatibilidad con código existente
      if (!this.subscribers.has(channel)) {
        this.subscribers.set(channel, []);
      }
      this.subscribers.get(channel).push(callbackOrObserver);
      
      console.log(`✅ Servicio suscrito a: ${channel} (ID: ${subscriptionId})`);
    } else {
      throw new Error('subscribe() requiere un callback function o una instancia de Observer');
    }
    
    // También obtener eventos históricos
    const observer = channelObservers.get(subscriptionId);
    this.getHistoricalEvents(channel, (event) => observer.update(event, channel));
    
    return subscriptionId;
  }

  /**
   * Desuscribirse de eventos (Patrón Observer)
   * 
   * @param {string} channel - Canal del que desuscribirse
   * @param {string} subscriptionId - ID de la suscripción a eliminar
   * @returns {boolean} true si se eliminó exitosamente, false si no se encontró
   */
  unsubscribe(channel, subscriptionId) {
    if (!this.observers.has(channel)) {
      console.log(`⚠️ Canal ${channel} no tiene observadores`);
      return false;
    }
    
    const channelObservers = this.observers.get(channel);
    
    if (channelObservers.has(subscriptionId)) {
      channelObservers.delete(subscriptionId);
      console.log(`✅ Observer desuscrito de: ${channel} (ID: ${subscriptionId})`);
      
      // Si no quedan observadores, limpiar el canal
      if (channelObservers.size === 0) {
        this.observers.delete(channel);
      }
      
      return true;
    }
    
    console.log(`⚠️ Suscripción ${subscriptionId} no encontrada en canal ${channel}`);
    return false;
  }

  /**
   * Desuscribir todos los observadores de un canal
   * 
   * @param {string} channel - Canal a limpiar
   * @returns {number} Número de observadores eliminados
   */
  unsubscribeAll(channel) {
    if (!this.observers.has(channel)) {
      return 0;
    }
    
    const channelObservers = this.observers.get(channel);
    const count = channelObservers.size;
    
    channelObservers.clear();
    this.observers.delete(channel);
    this.subscribers.delete(channel);
    
    console.log(`✅ ${count} observadores desuscritos de: ${channel}`);
    return count;
  }

  /**
   * Obtener lista de suscripciones de un canal
   * 
   * @param {string} channel - Canal a consultar
   * @returns {Array} Array de IDs de suscripciones
   */
  getSubscriptions(channel) {
    if (!this.observers.has(channel)) {
      return [];
    }
    
    return Array.from(this.observers.get(channel).keys());
  }

  /**
   * Obtener información de todas las suscripciones
   * 
   * @returns {Object} Objeto con información de suscripciones por canal
   */
  getAllSubscriptions() {
    const subscriptions = {};
    
    for (const [channel, observers] of this.observers.entries()) {
      subscriptions[channel] = {
        count: observers.size,
        observerIds: Array.from(observers.keys())
      };
    }
    
    return subscriptions;
  }

  /**
   * Verificar si hay observadores en un canal
   * 
   * @param {string} channel - Canal a verificar
   * @returns {boolean} true si hay observadores, false si no
   */
  hasObservers(channel) {
    return this.observers.has(channel) && this.observers.get(channel).size > 0;
  }

  /**
   * Notificar a observadores (Patrón Observer)
   * 
   * Notifica a todos los observadores suscritos al canal
   * 
   * @param {string} channel - Canal del evento
   * @param {Object} event - Evento a notificar
   */
  notifySubscribers(channel, event) {
    // Notificar a observadores (Patrón Observer formal)
    if (this.observers.has(channel)) {
      const channelObservers = this.observers.get(channel);
      
      for (const [observerId, observer] of channelObservers.entries()) {
        try {
          observer.update(event, channel);
        } catch (error) {
          console.error(`❌ Error en observer ${observerId}:`, error.message);
        }
      }
    }
    
    // Compatibilidad: Notificar a callbacks antiguos (si existen)
    const channelSubscribers = this.subscribers.get(channel) || [];
    channelSubscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('❌ Error en callback:', error.message);
      }
    });
  }

  // Obtener eventos históricos del canal
  async getHistoricalEvents(channel, callback) {
      try {
          const events = await this.redis.lrange(`channel:${channel}`, 0, 0); // Últimos 1 eventos
          console.log(`📚 Obteniendo ${events.length} eventos históricos de: ${channel}`);
          
          for (const eventStr of events.reverse()) { // Del más antiguo al más nuevo
              try {
                  let event;
                  
                  // DETECTAR si ya es un objeto o necesita parseo
                  if (typeof eventStr === 'string') {
                      // Intentar parsear como JSON
                      event = JSON.parse(eventStr);
                  } else if (typeof eventStr === 'object' && eventStr !== null) {
                      // Ya es un objeto, usarlo directamente
                      event = eventStr;
                  } else {
                      console.log(`⚠️ Formato de evento no reconocido:`, typeof eventStr);
                      continue;
                  }
                  
                  callback(event);
              } catch (parseError) {
                  console.error('❌ Error procesando evento histórico:', parseError.message);
                  console.log('📄 Contenido del evento:', eventStr);
              }
          }
      } catch (error) {
          console.error('❌ Error obteniendo eventos históricos:', error.message);
      }
  }
}

// Exportar la instancia única del EventBus (Singleton)
// Se crea automáticamente al importar este módulo
export const eventBus = UpstashEventBus.getInstance();

// También exportar la clase para acceso avanzado si es necesario
export { UpstashEventBus };