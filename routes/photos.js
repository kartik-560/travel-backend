import express from 'express';
import multer from 'multer';
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", async (req, res) => {
  try {
    const { title, images } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: "No images provided." });
    }

    const gallery = await prisma.photoGallery.create({
      data: { title, images },
    });

    res.status(201).json({ message: "Uploaded successfully", gallery });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get('/', async (req, res) => {
  try {
    const all = await prisma.photoGallery.findMany({
      orderBy: { uploadedAt: 'desc' },
    });
    res.json(all);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ message: 'Fetch failed' });
  }
});

export default router;
