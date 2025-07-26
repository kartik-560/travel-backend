import express, { json } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import tripsRoute from "./routes/trips.js";
import dotenv from "dotenv";
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

dotenv.config();
const prisma = new PrismaClient();


app.use(cors());
app.use(json());

app.use("/api/trips", tripsRoute);

// Health check route
app.get("/", (req, res) => {
  res.send("✅ Travel API is running...");
});

app.listen(5000, () => {
  console.log("✅ API running on http://localhost:5000");
});
