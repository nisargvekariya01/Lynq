import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  handleClaimLinks,
  handleGetUserLinks,
  handleGetUserAnalyticsSummary,
} from "../controllers/userController.js";

const router = Router();

// All user routes require authentication
router.use(requireAuth);

// POST /api/user/claim-links
router.post("/claim-links", handleClaimLinks);

// GET /api/user/links
router.get("/links", handleGetUserLinks);

// GET /api/user/analytics/summary
router.get("/analytics/summary", handleGetUserAnalyticsSummary);

export default router;
