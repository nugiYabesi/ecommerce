import { Router } from "express";
import { deleteMyAccount, login, register, requestAccountDeletionCode, verifyLogin } from "../controllers/authController";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.post("/login/verify", verifyLogin);
router.post("/account/delete-code", authMiddleware, requestAccountDeletionCode);
router.delete("/account", authMiddleware, deleteMyAccount);

export default router;
