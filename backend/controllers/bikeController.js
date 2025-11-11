import { bicicletaService } from "../services/bike/bike.services.js";

export const getEstaciones = async (req, res) => {
  const data = await bicicletaService.listarEstaciones();
  



  res.json(data);
};


export const getBicicletasPorEstacion = async (req, res) => {
  const data = await bicicletaService.listarBicicletasPorEstacion(req.params.id);
  res.json(data);
};

/*
export const getTelemetriaActual = async (req, res) => {
  const data = await bicicletaService.obtenerTelemetriaActual(req.params.id);
  res.json(data);
};

export const getTelemetriaHistorico = async (req, res) => {
  const data = await bicicletaService.obtenerTelemetriaHistorico(req.params.id);
  res.json(data);
};
*/