import { supabase } from "../../shared/supabase/client.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

const stationTable = "Estacion";

class StationHandler {
    constructor() { }

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
            
            // 3. PROGRAMAR reasignación en 1 minuto (para testing) o 30 minutos (producción)
            const TIEMPO_REDISTRIBUCION = 3 * 60 * 1000; // 1 minuto para testing
            console.log(`⏰ Programando reasignación en ${TIEMPO_REDISTRIBUCION/1000} segundos...`);
            
            setTimeout(async () => {
                try {
                    await this.reasignarBicicletas(estacionId, bicicletasParaMover);
                } catch (error) {
                    console.error('❌ Error en reasignación automática:', error);
                }
            }, TIEMPO_REDISTRIBUCION);
            
            // 4. Notificar
            await this.notificarRedistribucionAutomatica(estacionId, bicicletasParaMover);
            
        } catch (error) {
            console.error('❌ Error en manejarEstacionVacia:', error);
            throw error;
        }
    }

    async bloquearBicicletasParaRedistribucion(bicicletas) {
        try {
            const bikeIds = bicicletas.map(b => b.id);
            
            console.log(`🔒 Bloqueando ${bikeIds.length} bicicletas para redistribución...`);
            
            const { error } = await supabase
                .from('Bicicleta')
                .update({
                    idEstacion: null,
                    estado: 'En_Redistribucion'
                })
                .in('id', bikeIds);
                
            if (error) throw error;
            
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
            
            // 1. Actualizar bicicletas (idEstacion y estado)
            const { error: updateError } = await supabase
                .from('Bicicleta')
                .update({
                    idEstacion: estacionDestinoId,
                    estado: 'Disponible'
                })
                .in('id', bikeIds);
                
            if (updateError) throw updateError;
            
            // 2. Actualizar contador de la estación destino
            const { data: estacion, error: estacionError } = await supabase
                .from('Estacion')
                .select('cantidadBicicletas')
                .eq('id', estacionDestinoId)
                .single();
                
            if (estacionError) throw estacionError;
            
            const nuevaCantidad = estacion.cantidadBicicletas + bicicletas.length;
            
            const { error: counterError } = await supabase
                .from('Estacion')
                .update({ cantidadBicicletas: nuevaCantidad })
                .eq('id', estacionDestinoId);
                
            if (counterError) throw counterError;
            
            console.log(`✅ ${bicicletas.length} bicicletas reasignadas a estación ${estacionDestinoId}`);
            console.log(`📊 Nueva cantidad en estación: ${nuevaCantidad} bicicletas`);
            
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

    async notificarRedistribucionAutomatica(estacionId, bicicletas) {
        await eventBus.publish(CHANNELS.NOTIFICACIONES, {
            type: "redistribucion_automatica_iniciada",
            data: {
                estacionId: estacionId,
                cantidadBicicletas: bicicletas.length,
                bicicletas: bicicletas.map(b => b.id),
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
export const stationHandler = new StationHandler();