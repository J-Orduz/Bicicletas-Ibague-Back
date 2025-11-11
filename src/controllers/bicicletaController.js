import * as bicicletaService from "../services/bicicleta.service.js";

export const getBicicletas = async (req, res) => {
  const data = await bicicletaService.listarBicicletas();
  res.json(data);
};

export const getBicicletasPorTipo = async (req, res) => {
  const data = await bicicletaService.listarPorTipo(req.params.tipo);
  res.json(data);
};

export const getTelemetriaActual = async (req, res) => {
  const data = await bicicletaService.obtenerTelemetriaActual(req.params.id);
  res.json(data);
};

export const getTelemetriaHistorico = async (req, res) => {
  const data = await bicicletaService.obtenerTelemetriaHistorico(req.params.id);
  res.json(data);
};