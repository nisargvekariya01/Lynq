import { checkUrlStatus } from "../services/statusService.js";

/**
 * GET /api/status/:shortCode
 * Returns live status of the destination URL (with Redis caching).
 */
export const handleCheckStatus = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const result = await checkUrlStatus(shortCode);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
