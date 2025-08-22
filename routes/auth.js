import express from "express";
import { basicAuth } from "../middleware/basicAuth.js";

const router = express.Router();

router.post("/login", basicAuth, (req, res) => {
  res.json({ user: req.user, stateless: true });
});

router.get("/me", basicAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
