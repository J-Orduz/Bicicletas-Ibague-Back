import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

// CARGAR variables de entorno PRIMERO
dotenv.config();

class UpstashEventBus {
  constructor() {
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
    
    this.subscribers = new Map(); // { channel: [callbacks] }
    console.log('🚀 Upstash Redis Event-Bus configurado correctamente');
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

  // Suscribirse a eventos (para servicios en la misma instancia)
  subscribe(channel, callback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
    }
    this.subscribers.get(channel).push(callback);
    console.log(`✅ Servicio suscrito a: ${channel}`);
    
    // También obtener eventos históricos
    this.getHistoricalEvents(channel, callback);
  }

  // Notificar a subscribers locales
  notifySubscribers(channel, event) {
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

export const eventBus = new UpstashEventBus();