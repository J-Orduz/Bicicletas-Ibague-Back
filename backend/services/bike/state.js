export const BikeStatus = {
  EN_USO: 'En_Viaje',
  DISPONIBLE: 'Disponible',
  BLOQUEADA: 'Bloqueada',
  MANTENIMIENTO: 'Mantenimiento',
  RESERVADA: 'Reservada',
  ABANDONADA: 'Abandonada'
};

export const BatteryStatus = {
  CARGADA: 'Cargada',
  BAJA: 'Baja',
  DAMAGED: 'Dañada',
};

const MAX_BATTERY = 100;

export const BatteryLevel = {
  full: 0xff_ff_ff_ff,
  low: 0xff_ff_ff_ff / 4,
  zero: 0,
};

export class Telemetria {
  constructor(long, lat, bateria, estadoCandado) {
    // TODO: asegurar que el id generado es único
    this.id = Math.floor(Math.random() * 0xff), // numero entre 0 y 255
    this.latitud = lat;
    this.longitud = long;
    this.bateria = bateria;
    this.estadoCandado = estadoCandado;
    this.fechaConsulta = "";
  }

  dto(bikeId) {
    return {
      id: this.id,
      IDbicicleta: bikeId,
      latitud: this.latitud,
      longitud: this.longitud,
      bateria: this.bateria,
      estadoCandado: this.estadoCandado,
      fechaConsulta: new Date()
    };
  }
};

export class Bike {
  constructor(id, marca, tipo, estado, idEstacion, numero_serie) {
    this.id = id;
    this.marca = marca;
    this.tipo = tipo;
    this.estado = estado;
    this.idEstacion = idEstacion;
    this.numero_serie = numero_serie;
  }

  dto() {} // TODO: implementar data transfer object
};