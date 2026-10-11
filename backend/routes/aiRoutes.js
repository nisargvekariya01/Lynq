import { Router } from "express";
import {
  handleSuggest,
  handleGetSummary,
  handleSuggestAliases,
} from "../controllers/aiController.js";

const router = Router();

// POST /api/ai/suggest
router.post("/suggest", handleSuggest);

// GET /api/ai/summary/:shortCode
router.get("/summary/:shortCode", handleGetSummary);

// POST /api/ai/suggest-aliases
router.post("/suggest-aliases", handleSuggestAliases);

export default router;
