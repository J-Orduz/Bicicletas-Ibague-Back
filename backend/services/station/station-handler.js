import { supabase } from "../../shared/supabase/client.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

const stationTable = "Estacion";

/**
 * StationHandler Singleton
 * Garantiza una única instancia del handler de estaciones
 * Patrón Singleton aplicado
 */
class StationHandler {
    // Variable estática para almacenar la instancia única
    static instance = null;

    constructor() {
        // Si ya existe una instancia, retornarla en lugar de crear una nueva
        if (StationHandler.instance) {
            console.log('⚠️ StationHandler ya existe, retornando instancia existente (Singleton)');
            return StationHandler.instance;
        }

        // Guardar la instancia
        StationHandler.instance = this;
        console.log('✅ StationHandler instanciado (Singleton)');
    }

    /**
     * Método estático para obtener la instancia única (patrón Singleton)
     * @returns {StationHandler} La instancia única del StationHandler
     */
    static getInstance() {
        if (!StationHandler.instance) {
            StationHandler.instance = new StationHandler();
        }
        return StationHandler.instance;
    }

    /**
     * Método para resetear la instancia (útil para testing)
     */
    static resetInstance() {
        StationHandler.instance = null;
    }

    async getAllStations() {
        const { data, error } = await supabase
            .from(stationTable)
            .select("*");
        if (error) {
            console.error(`Error obteniendo estaciones: ${error.message}`);
            throw error;
        }
        return data;
    }
    async getStationById(reserva) {

        const idReserva = reserva?.idReserva;
        const estacionId = reserva?.idEstacion;

        if (!estacionId) {
            throw new Error("No se recibió idEstacion");
        }

        const { data: estacion, error } = await supabase
            .from(stationTable)
            .select("*")
            .eq("id", estacionId)
            .single();

        if (error || !estacion) {
            console.error(`❌ Error obteniendo estación con ID ${estacionId}:`, error);
            throw new Error("No se pudo obtener la estación");
        }

        if (idReserva) {
            await eventBus.publish(CHANNELS.VIAJES, {
                type: "estacion_obtenida",
                data: {
                    id: estacion.id,
                    idReserva: idReserva,
                    nombre: estacion.nombre,
                    posicion: {
                        latitud: estacion.posicion.latitud,
                        longitud: estacion.posicion.longitud
                    },
                    tipoEstacion: estacion.tipoEstacion
                }
            });
        }

        return estacion;
    }

    async createStation(stationData) {
        const { data, error } = await supabase
            .from(stationTable)
            .insert([stationData])
            .single();
        if (error) {
            console.error(`Error creando estaciones: ${error.message}`);
            throw error;
        }

        return data;
    }
    /*
    async updateStation(stationId, stationData) {
        const { data, error } = await supabase
            .from(stationTable)
            .update(stationData)
            .eq("id", stationId)
            .single();
        if (error) {
            console.error(`Error modificando estación con ID ${stationId}: ${error.message}`);
            throw error;
        }
        eventBus.publish(CHANNELS.STATION.UPDATED, data);
        return data;
    }
*/

    async manejarEstacionVacia(estacionId) {
        try {
            console.log(`🔄 Iniciando redistribución AUTOMÁTICA para estación ${estacionId}`);

            // Establecer fecha_redistribucion en la base de datos
            const ahora = new Date();
            const fechaRedistribucion = new Date(ahora.getTime() + 30 * 60 * 1000); // 30 minutos
            
            console.log(`📅 Intentando establecer fecha de redistribución: ${fechaRedistribucion.toISOString()}`);
            
            const { error: fechaError } = await supabase
                .from('Estacion')
                .update({ 
                    fecha_redistribucion: fechaRedistribucion.toISOString()
                })
                .eq('id', estacionId);
                
            if (fechaError) {
                console.error('❌ Error estableciendo fecha de redistribución:', fechaError);
                // No lanzamos error aquí para no interrumpir el proceso de redistribución
            } else {
                console.log(`✅ Fecha de redistribución establecida en BD: ${fechaRedistribucion.toLocaleString()}`);
                
                // Confirmar que se guardó en la BD
                const { data: estacionVerificada, error: errorVerificacion } = await supabase
                    .from('Estacion')
                    .select('fecha_redistribucion')
                    .eq('id', estacionId)
                    .single();
                    
                if (errorVerificacion) {
                    console.error('❌ Error verificando fecha en BD:', errorVerificacion);
                } else {
                    console.log(`🔍 Fecha en BD después de actualizar: ${estacionVerificada.fecha_redistribucion}`);
                }
            }
            
            // 1. Buscar bicicletas disponibles
            const bicicletasParaMover = await this.buscarBicicletasParaRedistribucion(estacionId);
            
            if (bicicletasParaMover.length === 0) {
                console.log('⚠️ No se encontraron bicicletas para redistribución');
                return;
            }
            
            console.log(`🚲 Encontradas ${bicicletasParaMover.length} bicicletas para redistribuir:`, 
                    bicicletasParaMover.map(b => b.id));
            
            // 2. BLOQUEAR BICICLETAS (idEstacion = NULL, estado = EN_REDISTRIBUCION)
            await this.bloquearBicicletasParaRedistribucion(bicicletasParaMover);
            
            // 3. PROGRAMAR reasignación 30 minutos
            const TIEMPO_REDISTRIBUCION = 30 * 60 * 1000;  // 30 minutos 
            console.log(`⏰ Programando reasignación en ${TIEMPO_REDISTRIBUCION/1000} segundos...`);
            
            setTimeout(async () => {
                try {
                    await this.reasignarBicicletas(estacionId, bicicletasParaMover);
                } catch (error) {
                    console.error('❌ Error en reasignación automática:', error);
                }
            }, TIEMPO_REDISTRIBUCION);
            
            // 4. Notificar - Pasar fechaRedistribucion como parámetro
            await this.notificarRedistribucionAutomatica(estacionId, bicicletasParaMover, fechaRedistribucion);
            
        } catch (error) {
            console.error('❌ Error en manejarEstacionVacia:', error);
            throw error;
        }
    }

    async bloquearBicicletasParaRedistribucion(bicicletas) {
        try {
            const bikeIds = bicicletas.map(b => b.id);
            
            console.log(`🔒 Bloqueando ${bikeIds.length} bicicletas para redistribución...`);

            // Obtener las estaciones de origen ANTES de actualizar
            const estacionesOrigen = [...new Set(bicicletas.map(b => b.idEstacion).filter(id => id !== null))];
            console.log(`🏪 Estaciones de origen afectadas:`, estacionesOrigen);

            // Obtener cantidadBicicletas actual de cada estación
            const contadoresAntes = {};
            for (const estacionId of estacionesOrigen) {
                const { data: estacion, error } = await supabase
                    .from('Estacion')
                    .select('cantidadBicicletas')
                    .eq('id', estacionId)
                    .single();
                if (!error && estacion) {
                    contadoresAntes[estacionId] = estacion.cantidadBicicletas;
                }
            }
            console.log(`📊 Contadores antes de quitar bicicletas:`, contadoresAntes);
            
            const { error } = await supabase
                .from('Bicicleta')
                .update({
                    idEstacion: null,
                    estado: 'En_Redistribucion'
                })
                .in('id', bikeIds);
                
            if (error) throw error;

             // Actualizar manualmente cantidadBicicletas para cada estación de origen
            for (const estacionId of estacionesOrigen) {
                // Contar bicicletas que todavía tienen esta estación como idEstacion
                const { count, error: countError } = await supabase
                    .from('Bicicleta')
                    .select('*', { count: 'exact', head: true })
                    .eq('idEstacion', estacionId)
                    .eq('estado', 'Disponible');
                    
                if (!countError) {
                    const nuevaCantidad = count;
                    const { error: updateError } = await supabase
                        .from('Estacion')
                        .update({ cantidadBicicletas: nuevaCantidad })
                        .eq('id', estacionId);
                        
                    if (!updateError) {
                        console.log(`✅ Estación ${estacionId} actualizada: ${contadoresAntes[estacionId]} -> ${nuevaCantidad} bicicletas`);
                    } else {
                        console.error(`❌ Error actualizando estación ${estacionId}:`, updateError);
                    }
                }
            }
            
            console.log(`✅ ${bikeIds.length} bicicletas bloqueadas exitosamente`);
            
        } catch (error) {
            console.error('Error bloqueando bicicletas:', error);
            throw error;
        }
    }

    async programarReasignacion(estacionDestinoId, bicicletas) {
        const TIEMPO_REDISTRIBUCION = 1 * 60 * 1000; // 30 minutos en milisegundos
        
        console.log(`⏰ Programando reasignación en ${TIEMPO_REDISTRIBUCION/60000} minutos...`);
        
        setTimeout(async () => {
            try {
                await this.reasignarBicicletas(estacionDestinoId, bicicletas);
            } catch (error) {
                console.error('❌ Error en reasignación automática:', error);
            }
        }, TIEMPO_REDISTRIBUCION);
    }

    async reasignarBicicletas(estacionDestinoId, bicicletas) {
        try {
            console.log(`🎯 Reasignando ${bicicletas.length} bicicletas a estación ${estacionDestinoId}`);
            
            const bikeIds = bicicletas.map(b => b.id);
            
            // Obtener cantidadBicicletas actual ANTES de la actualización
            const { data: estacionAntes, error: estacionAntesError } = await supabase
                .from('Estacion')
                .select('cantidadBicicletas')
                .eq('id', estacionDestinoId)
                .single();
                
            if (!estacionAntesError) {
                console.log(`📊 Estación ${estacionDestinoId} antes: ${estacionAntes.cantidadBicicletas} bicicletas`);
            }
            
            // 1. Actualizar bicicletas (idEstacion y estado)
            const { error: updateError } = await supabase
                .from('Bicicleta')
                .update({
                    idEstacion: estacionDestinoId,
                    estado: 'Disponible'
                })
                .in('id', bikeIds);
                
            if (updateError) throw updateError;
            
            // Contar las bicicletas actuales
            const { count, error: countError } = await supabase
                .from('Bicicleta')
                .select('*', { count: 'exact', head: true })
                .eq('idEstacion', estacionDestinoId)
                .eq('estado', 'Disponible');
                
            if (countError) throw countError;
            
            // Actualizar con el conteo real
            const { error: counterError } = await supabase
                .from('Estacion')
                .update({ 
                    cantidadBicicletas: count,
                    fecha_redistribucion: null  // Limpiar fecha cuando se completa
                })
                .eq('id', estacionDestinoId);
                
            if (counterError) throw counterError;
            
            console.log(`✅ ${bicicletas.length} bicicletas reasignadas a estación ${estacionDestinoId}`);
            console.log(`📊 Nueva cantidad en estación (conteo real): ${count} bicicletas`);
            
            // 3. Publicar evento de redistribución completada
            await eventBus.publish(CHANNELS.ESTACIONES, {
                type: "redistribucion_completada",
                data: {
                    estacionId: estacionDestinoId,
                    bicicletasReasignadas: bikeIds,
                    cantidad: bicicletas.length,
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Error en reasignarBicicletas:', error);
            throw error;
        }
    }

    async notificarRedistribucionAutomatica(estacionId, bicicletas, fechaRedistribucion) {
        await eventBus.publish(CHANNELS.NOTIFICACIONES, {
            type: "redistribucion_automatica_iniciada",
            data: {
                estacionId: estacionId,
                cantidadBicicletas: bicicletas.length,
                bicicletas: bicicletas.map(b => b.id),
                fecha_redistribucion: fechaRedistribucion.toISOString(),
                timestamp: new Date().toISOString(),
                reasignacionProgramada: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                mensaje: `Redistribución automática iniciada. ${bicicletas.length} bicicletas serán asignadas en 30 minutos.`
            }
        });
    }

    async buscarBicicletasParaRedistribucion(estacionDestinoId) {
        try {
            console.log(`🔍 Buscando 6 bicicletas para redistribución (excluyendo estación ${estacionDestinoId})`);
            
            // 1. Obtener todas las estaciones con sus contadores (excluyendo la vacía)
            const { data: estaciones, error: estacionesError } = await supabase
                .from('Estacion')
                .select('id, cantidadBicicletas, nombre')
                .neq('id', estacionDestinoId)
                .gt('cantidadBicicletas', 6); // Estaciones con más de 6 bicicletas

            if (estacionesError) {
                console.error('❌ Error obteniendo estaciones:', estacionesError);
                throw estacionesError;
            }
            
            console.log(`🏪 Estaciones disponibles para redistribución:`, estaciones);
            
            if (!estaciones || estaciones.length === 0) {
                console.log('⚠️ No hay estaciones con bicicletas suficientes');
                return [];
            }
            
            const bicicletasSeleccionadas = [];
            
            // 2. Buscar en cada estación (máximo 2 bicicletas por estación)
            for (const estacion of estaciones) {
                if (bicicletasSeleccionadas.length >= 6) break;
                
                const cantidadNecesaria = 6 - bicicletasSeleccionadas.length;
                const maxPorEstacion = Math.min(2, cantidadNecesaria);
                
                console.log(`🔍 Buscando ${maxPorEstacion} bicicletas en estación ${estacion.id} (${estacion.nombre})`);
                
                // Buscar bicicletas disponibles en esta estación
                const { data: bicicletas, error: bikesError } = await supabase
                    .from('Bicicleta')
                    .select('id, idEstacion, estado, numero_serie')
                    .eq('idEstacion', estacion.id)
                    .eq('estado', 'Disponible')
                    .limit(maxPorEstacion);
                    
                if (bikesError) {
                    console.error(`❌ Error buscando bicicletas en estación ${estacion.id}:`, bikesError);
                    continue;
                }
                
                if (bicicletas && bicicletas.length > 0) {
                    bicicletasSeleccionadas.push(...bicicletas);
                    console.log(`✅ Encontradas ${bicicletas.length} bicicletas en estación ${estacion.id}`);
                } else {
                    console.log(`ℹ️ No se encontraron bicicletas disponibles en estación ${estacion.id}`);
                }
            }
            
            console.log(`🎯 Total bicicletas seleccionadas para redistribución: ${bicicletasSeleccionadas.length}`);
            return bicicletasSeleccionadas;
            
        } catch (error) {
            console.error('❌ Error en buscarBicicletasParaRedistribucion:', error);
            throw error;
        }
    }

    async crearOrdenRedistribucion(estacionId, bicicletas) {
        const orden = {
            estacion_destino: estacionId,
            bicicletas_asignadas: bicicletas.map(b => b.id),
            cantidad: bicicletas.length,
            timestamp: new Date().toISOString(),
            sla_minutos: 30,
            estado: 'pendiente'
        };

        // Publicar evento para el sistema de logística
        await eventBus.publish(CHANNELS.ESTACIONES, {
            type: "orden_redistribucion_creada",
            data: orden
        });

        return orden;
    }

    async notificarEquipoLogistica(estacionId, bicicletas) {
        await eventBus.publish(CHANNELS.NOTIFICACIONES, {
            type: "redistribucion_requerida",
            data: {
                estacionId: estacionId,
                cantidadBicicletas: bicicletas.length,
                bicicletas: bicicletas.map(b => b.id),
                timestamp: new Date().toISOString(),
                mensaje: `Estación ${estacionId} requiere ${bicicletas.length} bicicletas`
            }
        });
    }


}
// Exportar la instancia única del StationHandler (Singleton)
// Se crea automáticamente al importar este módulo
export const stationHandler = StationHandler.getInstance();

// También exportar la clase para acceso avanzado si es necesario
export { StationHandler };