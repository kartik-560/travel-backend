import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./routes/auth.js";
import tripsRoute from "./routes/trips.js";
import photosRoute from "./routes/photos.js";
import { basicAuth, requireAdmin } from "./middleware/basicAuth.js";
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

dotenv.config();


app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",").map(s => s.trim()) || "*",
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));



const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
function protectWrites(req, res, next) {
  if (WRITE_METHODS.has(req.method)) {
    return basicAuth(req, res, () => requireAdmin(req, res, next));
  }
  return next();
}
app.use("/api/auth", authRouter);
app.use("/api/trips", (req, res, next) => {
  if (req.method === "POST") {
    return tripsRoute(req, res, next);
  }
  return protectWrites(req, res, next);
}, tripsRoute);
app.use("/api/photos", protectWrites, photosRoute);

app.get("/", (req, res) => {
  res.send("✅ Travel API is running...");
});

app.listen(5000, () => {
  console.log("✅ API running on http://localhost:5000");
});
