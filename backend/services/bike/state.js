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

export const BatteryLevel = {
  full: 0xff,
  low: 0xff / 4,
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
};