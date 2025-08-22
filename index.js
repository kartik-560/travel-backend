import express, { json } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import tripsRoute from "./routes/trips.js";
import dotenv from "dotenv";
 import photosRoute from "./routes/photos.js";
 import { basicAuth, requireAdmin } from "./middleware/basicAuth.js";
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

dotenv.config();
const prisma = new PrismaClient();


app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",").map(s => s.trim()) || "*",
  credentials: true
}));
app.use(json());

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
function protectWrites(req, res, next) {
  if (WRITE_METHODS.has(req.method)) {
    return basicAuth(req, res, () => requireAdmin(req, res, next));
  }
  return next();
}
app.use("/api/auth", authRouter);
app.use("/api/trips", protectWrites, tripsRoute);
app.use("/api/photos", protectWrites, photosRoute);

app.get("/", (req, res) => {
  res.send("✅ Travel API is running...");
});

app.listen(5000, () => {
  console.log("✅ API running on http://localhost:5000");
});
