import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

const DEFAULT_CATEGORIES = [
  "Adventure & Trekking",
  "Cultural & Heritage Tours",
  "Leisure & Offbeat Escapes",
  "Spiritual & Wellness Retreats",
];

// GET /api/categories
router.get("/", async (req, res) => {
  try {
    let categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });

    // If no categories in collection yet, seed the 4 default base categories
    if (categories.length === 0) {
      for (const name of DEFAULT_CATEGORIES) {
        try {
          await prisma.category.create({ data: { name } });
        } catch {
          // ignore duplicates
        }
      }

      categories = await prisma.category.findMany({
        orderBy: { name: "asc" },
      });
    }

    // Attach count of trips assigned to each category
    const trips = await prisma.trip.findMany({
      select: { category: true },
    });
    const countMap = {};
    trips.forEach((t) => {
      const cName = t.category || "Uncategorized";
      countMap[cName] = (countMap[cName] || 0) + 1;
    });

    const result = categories.map((c) => ({
      ...c,
      tripCount: countMap[c.name] || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST /api/categories
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const trimmed = name.trim();
    const existing = await prisma.category.findFirst({
      where: { name: { equals: trimmed, mode: "insensitive" } },
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    const created = await prisma.category.create({
      data: { name: trimmed },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error("❌ Error creating category:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PUT /api/categories/:id - Edit / Rename category
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const trimmed = name.trim();
    const oldCat = await prisma.category.findUnique({ where: { id } });
    if (!oldCat) {
      return res.status(404).json({ error: "Category not found" });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name: trimmed },
    });

    // Update any trips using the old category name so they stay in sync
    if (oldCat.name !== trimmed) {
      await prisma.trip.updateMany({
        where: { category: oldCat.name },
        data: { category: trimmed },
      });
    }

    res.json(updated);
  } catch (error) {
    console.error("❌ Error updating category:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/categories/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    await prisma.category.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("❌ Error deleting category:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
