import express from "express";
import { generateReport } from "../controllers/reportController.js";

const router = express.Router();

// POST /api/reports
router.post("/", generateReport);

export default router;
