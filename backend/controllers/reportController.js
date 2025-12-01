import path from "path";
import { fileURLToPath } from "url";
import * as reportService from "../services/report/reportService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateReport(req, res, next) {
  try {
    const {
      reportType = "xlsx",
      reportName = "report",
      filters = {},
      pagination = {},
      async: isAsync = false,
    } = req.body || {};

    if (!["xlsx", "pdf"].includes(reportType)) {
      return res
        .status(400)
        .json({ error: 'reportType must be "xlsx" or "pdf"' });
    }

    // For now we support synchronous generation for reasonably sized exports.
    if (reportType === "xlsx") {
      const filename = `${reportName}-${Date.now()}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      // Stream workbook directly to response
      try {
        await reportService.generateXlsxStream(
          res,
          reportName,
          filters,
          pagination
        );
      } catch (err) {
        if (err && err.message === "TOO_LARGE") {
          return res
            .status(413)
            .json({
              error:
                "Report too large for synchronous generation. Please request async generation.",
            });
        }
        throw err;
      }
      return;
    }

    if (reportType === "pdf") {
      const filename = `${reportName}-${Date.now()}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      const buffer = await reportService.generatePdfBuffer(
        reportName,
        filters,
        pagination
      );
      return res.send(buffer);
    }
  } catch (err) {
    next(err);
  }
}
