import { eventBus } from './event-bus/index.js';
import { CHANNELS } from './event-bus/channels.js';

async function testEventBus() {
  console.log('🧪 Probando Event-Bus con Upstash...');
  
  // Dar tiempo para que Redis se configure
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Suscribirse primero
  eventBus.subscribe(CHANNELS.USUARIOS, (event) => {
    console.log('🎉 ¡Evento recibido!', event.type, event.data);
  });
  
  // Esperar un momento para que se procese la suscripción
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Publicar un evento de prueba
  await eventBus.publish(CHANNELS.USUARIOS, {
    type: 'UsuarioRegistrado',
    data: { 
      id: 'test-123', 
      email: 'test@ibague.com',
      nombre: 'Usuario Test'
    }
  });
  
  console.log('✅ Prueba completada');
}

// Manejar errores no capturados
process.on('unhandledRejection', (error) => {
  console.error('❌ Error no manejado:', error.message);
});

testEventBus().catch(console.error);