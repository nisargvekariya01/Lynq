import { Router } from "express";
import { handleSuggest } from "../controllers/aiController.js";

const router = Router();

// POST /api/ai/suggest
// (apiLimiter is applied globally to all /api routes in server.js)
router.post("/suggest", handleSuggest);

export default router;
