import express from "express";
import prisma from "../prisma.js";

const router = express.Router();

const DEFAULT_TESTIMONIALS = [
  {
    name: "Seranne",
    role: "Traveler",
    category: "Adventure & Trekking",
    images: [
      "/assest/Enchanting_delhi_shimla/Himalaya.webp",
      "/assest/Enchanting_delhi_shimla/himalaya.webp",
    ],
    text: "They say that this means good luck, and I wish you all the luck with everything. I am very grateful for everything you did for me. Without you, I couldn’t make this trip so good. Shukriya!!",
    location: "Himalayas, India",
    rating: 5,
    tag: "High Mountain Trek",
    status: "PUBLISHED",
    order: 1,
  },
  {
    name: "Garlic Girls",
    role: "Road Trippers",
    category: "Leisure & Offbeat Escapes",
    images: ["/assest/Enchanting_delhi_shimla/Road_trip.webp"],
    text: "There are no bad people. Only good people, that do bad things. - Sunil, the wise (2019).",
    location: "India Roadtrip, August 2019",
    rating: 5,
    tag: "Mountain Roadtrip",
    status: "PUBLISHED",
    order: 2,
  },
  {
    name: "Shivangini Chauhan",
    role: "Traveler",
    category: "Adventure & Trekking",
    images: [
      "/assest/Enchanting_delhi_shimla/Spiti_valley.webp",
      "/assest/Enchanting_delhi_shimla/himachal.webp",
    ],
    text: "My recent trip to Spiti was incredible, not just because of the stunning location, but mainly due to the wonderful people I met along the way. Sunil Bhaiya's captivating Himachali stories added an extra layer of charm to the journey. Despite challenges like the lack of running water, it taught me the profound value of water in more ways than one. It feels like yesterday; Spiti, you are truly magnificent.",
    location: "Spiti Valley, Himachal Pradesh",
    rating: 5,
    tag: "Spiti Expedition",
    status: "PUBLISHED",
    order: 3,
  },
  {
    name: "Madhuri",
    role: "Pilgrim Traveler",
    category: "Spiritual & Wellness Retreats",
    images: [
      "/assest/Enchanting_delhi_shimla/Spiti_valley.webp",
      "/assest/Enchanting_delhi_shimla/gujrat.webp",
    ],
    text: "Traveling with mom to Dwarka, Somnath and Gir in Gujarat has been nothing but spectacular. Marvelous darshan to the temples and such warm hospitality made me grateful. Huge thanks to Sunil Bhai, who has always been by our side, taking special care of mom and ensuring everything went smoothly. Can’t thank you enough, Bhai, for being there.",
    location: "Dwarka, Gujarat",
    rating: 5,
    tag: "Sacred & Cultural",
    status: "PUBLISHED",
    order: 4,
  },
];

// Seed default testimonials if collection is empty
async function ensureSeededTestimonials() {
  try {
    const count = await prisma.testimonial.count();
    if (count === 0) {
      for (const t of DEFAULT_TESTIMONIALS) {
        await prisma.testimonial.create({ data: t });
      }
    }
  } catch (err) {
    console.error("Testimonial seed error:", err);
  }
}

// GET /api/testimonials
// Query params:
// - limit: number (e.g. 4 for home page)
// - category: string (optional category filter)
// - all: boolean string ("true" includes HIDDEN for admin)
// - search: search term for name/text/location
router.get("/", async (req, res) => {
  try {
    await ensureSeededTestimonials();

    const { limit, category, all, search } = req.query;
    const includeAll = all === "true" || all === true;

    const where = {};
    if (!includeAll) {
      where.status = { not: "HIDDEN" };
    }

    if (category && category !== "All") {
      where.category = category;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { text: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
        { role: { contains: q, mode: "insensitive" } },
      ];
    }

    const take = limit ? parseInt(limit, 10) : undefined;

    const [testimonials, total] = await Promise.all([
      prisma.testimonial.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: Number.isInteger(take) && take > 0 ? take : undefined,
      }),
      prisma.testimonial.count({ where }),
    ]);

    res.json({
      testimonials,
      total,
      count: testimonials.length,
    });
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    res.status(500).json({ error: "Failed to fetch testimonials" });
  }
});

// GET /api/testimonials/:id
router.get("/:id", async (req, res) => {
  try {
    const testimonial = await prisma.testimonial.findUnique({
      where: { id: req.params.id },
    });
    if (!testimonial) {
      return res.status(404).json({ error: "Testimonial not found" });
    }
    res.json(testimonial);
  } catch (error) {
    console.error("Error fetching testimonial:", error);
    res.status(500).json({ error: "Failed to fetch testimonial" });
  }
});

// POST /api/testimonials
router.post("/", async (req, res) => {
  try {
    const {
      name,
      role,
      category,
      images,
      text,
      location,
      rating,
      tag,
      status,
      order,
    } = req.body;

    if (!name || !text || !location) {
      return res.status(400).json({
        error: "Missing required fields: name, text, and location are required",
      });
    }

    // Normalize images: accept array of strings, or single string
    let parsedImages = [];
    if (Array.isArray(images)) {
      parsedImages = images.filter((img) => typeof img === "string" && img.trim() !== "");
    } else if (typeof images === "string" && images.trim() !== "") {
      parsedImages = [images.trim()];
    }

    const newTestimonial = await prisma.testimonial.create({
      data: {
        name: name.trim(),
        role: (role || "Traveler").trim(),
        category: (category || "Himalayas").trim(),
        images: parsedImages,
        text: text.trim(),
        location: location.trim(),
        rating: rating ? parseInt(rating, 10) : 5,
        tag: tag ? tag.trim() : null,
        status: status === "HIDDEN" ? "HIDDEN" : "PUBLISHED",
        order: order ? parseInt(order, 10) : 0,
      },
    });

    res.status(201).json(newTestimonial);
  } catch (error) {
    console.error("Error creating testimonial:", error);
    res.status(500).json({ error: "Failed to create testimonial" });
  }
});

// PUT /api/testimonials/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      role,
      category,
      images,
      text,
      location,
      rating,
      tag,
      status,
      order,
    } = req.body;

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (role !== undefined) data.role = role.trim();
    if (category !== undefined) data.category = category.trim();
    if (text !== undefined) data.text = text.trim();
    if (location !== undefined) data.location = location.trim();
    if (rating !== undefined) data.rating = parseInt(rating, 10);
    if (tag !== undefined) data.tag = tag ? tag.trim() : null;
    if (status !== undefined) data.status = status;
    if (order !== undefined) data.order = parseInt(order, 10);

    if (images !== undefined) {
      if (Array.isArray(images)) {
        data.images = images.filter((img) => typeof img === "string" && img.trim() !== "");
      } else if (typeof images === "string" && images.trim() !== "") {
        data.images = [images.trim()];
      } else {
        data.images = [];
      }
    }

    const updated = await prisma.testimonial.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating testimonial:", error);
    res.status(500).json({ error: "Failed to update testimonial" });
  }
});

// PATCH /api/testimonials/:id/status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["PUBLISHED", "HIDDEN"].includes(status)) {
      return res.status(400).json({ error: "Status must be PUBLISHED or HIDDEN" });
    }

    const updated = await prisma.testimonial.update({
      where: { id },
      data: { status },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating testimonial status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// DELETE /api/testimonials/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.testimonial.delete({
      where: { id },
    });
    res.json({ message: "Testimonial deleted successfully", id });
  } catch (error) {
    console.error("Error deleting testimonial:", error);
    res.status(500).json({ error: "Failed to delete testimonial" });
  }
});

export default router;

