import { Router } from "express";
import { create, getOne, list, remove, update } from "../controllers/productController";
import { authMiddleware } from "../middleware/authMiddleware";
import upload from "../middleware/uploadMiddleware";

const router = Router();
router.use(authMiddleware);
router.post("/", upload.single("image"), create);
router.get("/", list);
router.get("/:id", getOne);
router.put("/:id", upload.single("image"), update);
router.delete("/:id", remove);

export default router;
