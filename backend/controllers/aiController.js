import { generateSuggestions } from "../services/aiService.js";
import { isValidUrl } from "../utils/validator.js";

/**
 * POST /api/ai/suggest
 * Body: { url: string }
 */
export const handleSuggest = async (req, res, next) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res
        .status(400)
        .json({ success: false, error: "URL is required." });
    }

    if (!isValidUrl(url)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid URL provided." });
    }

    const suggestions = await generateSuggestions(url);

    return res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (err) {
    next(err);
  }
};
