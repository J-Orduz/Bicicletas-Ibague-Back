import express from "express";
import bicicletaRoutes from "./routes/bicicleta.routes.js";

const app = express();
app.use(express.json());

app.use("/api/bicicletas", bicicletaRoutes);

export default app;