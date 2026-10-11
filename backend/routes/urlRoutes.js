import { Router } from "express";
import { optionalAuth } from "../middlewares/auth.js";
import {
  handleShorten,
  handleGetInfo,
  handleVerifyPassword,
  handleEditUrl,
  handleDeleteUrl,
  handleCheckAlias,
  handleResolveAndTrack,
  handleLiveStream,
  handleExportCsv,
} from "../controllers/urlController.js";
import { handleCheckStatus } from "../controllers/statusController.js";
import { handleBulkShorten } from "../controllers/bulkController.js";

const router = Router();

// POST /api/shorten
router.post("/shorten", optionalAuth, handleShorten);

// POST /api/bulk-shorten
router.post("/bulk-shorten", handleBulkShorten);

// PUT /api/shorten/:shortCode
router.put("/shorten/:shortCode", handleEditUrl);

// DELETE /api/shorten/:shortCode
router.delete("/shorten/:shortCode", handleDeleteUrl);

// GET /api/info/:shortCode
router.get("/info/:shortCode", handleGetInfo);

// GET /api/analytics/:shortCode/export (Export CSV of historical click telemetry)
router.get("/analytics/:shortCode/export", handleExportCsv);

// GET /api/live/:shortCode (Server-Sent Events for real-time clicks)
router.get("/live/:shortCode", handleLiveStream);

// GET /api/resolve/:shortCode
router.get("/resolve/:shortCode", handleResolveAndTrack);

// GET /api/check-alias/:alias
router.get("/check-alias/:alias", handleCheckAlias);

// GET /api/status/:shortCode
router.get("/status/:shortCode", handleCheckStatus);

// POST /api/verify/:shortCode
router.post("/verify/:shortCode", handleVerifyPassword);

export default router;
