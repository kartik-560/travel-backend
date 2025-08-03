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

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await prisma.photoGallery.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Gallery deleted', deleted });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// PUT (Update) a photo gallery by ID
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, images } = req.body;

  try {
    const updated = await prisma.photoGallery.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(images && Array.isArray(images) && images.length > 0 && { images }),
      },
    });

    res.status(200).json({ message: 'Gallery updated', updated });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});


router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const gallery = await prisma.photoGallery.findUnique({
      where: { id },
    });

    if (!gallery) {
      return res.status(404).json({ message: 'Gallery not found' });
    }

    res.json(gallery);
  } catch (err) {
    console.error('Fetch by ID error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
export default router;
