import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

// ✅ ObjectID Validator (MongoDB)
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

function validateObjectId(req, res, next) {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid trip ID format" });
  }
  next();
}

// ✅ GET all trips
router.get("/", async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      include: {
        whatToExpect: true,
        days: true,
      },
    });
    res.json(trips);
  } catch (error) {
    console.error("❌ Error fetching trips:", error);
    res.status(500).json({ error: "Failed to fetch trips" });
  }
});



// ✅ GET a single trip by ID (with validation)
router.get("/:id", validateObjectId, async (req, res) => {
  const { id } = req.params;

  try {
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        whatToExpect: true,
        days: true,
      },
    });

    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    res.json(trip);
  } catch (error) {
    console.error("❌ Error fetching trip:", error);
    res.status(500).json({ error: "Failed to fetch trip" });
  }
});

// ✅ POST create a new trip
router.post("/", async (req, res) => {
  try {
    const {
      title,
      subTitle,
      maxElevation,
      duration,
      distance,
      difficulty,
      startPoint,
      endPoint,
      travel_description,
      highlights,
      images,
      category, // <-- add this
      what_to_expect,
      days,
    } = req.body;

    const trip = await prisma.trip.create({
      data: {
        title,
        subTitle,
        maxElevation,
        duration,
        distance,
        difficulty,
        startPoint,
        endPoint,
        travel_description,
        highlights,
        images,
        category, // <-- include in create
        whatToExpect: {
          create: what_to_expect,
        },
        days: {
          create: days.map((d) => ({
            day: d.day,
            description: d.description,
            distance: d.distance,
            duration: d.duration,
            highlights: d.highlights,
          })),
        },
      },
      include: {
        whatToExpect: true,
        days: true,
      },
    });

    res.status(201).json(trip);
  } catch (error) {
    console.error("❌ Error creating trip:", error);
    res.status(500).json({ error: "Failed to create trip", detail: error });
  }
});

// ✅ PUT update a trip by ID (with validation)
router.put("/:id", validateObjectId, async (req, res) => {
  const { id } = req.params;

  try {
    // Delete old related data first
    await prisma.whatToExpect.deleteMany({ where: { tripId: id } });
    await prisma.tripDay.deleteMany({ where: { tripId: id } });

    const {
      title,
      subTitle,
      maxElevation,
      duration,
      distance,
      difficulty,
      startPoint,
      endPoint,
      travel_description,
      highlights,
      images,
      what_to_expect,
      days,
      category,
    } = req.body;

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: {
        title,
        subTitle,
        maxElevation,
        duration,
        distance,
        difficulty,
        startPoint,
        endPoint,
        travel_description,
        highlights,
        images,
        category,
        whatToExpect: {
          create: what_to_expect,
        },
        days: {
          create: days.map((d) => ({
            day: d.day,
            description: d.description,
            distance: d.distance,
            duration: d.duration,
            highlights: d.highlights,
          })),
        },
      },
      include: {
        whatToExpect: true,
        days: true,
      },
    });

    res.json(updatedTrip);
  } catch (error) {
    console.error("❌ Error updating trip:", error);
    res.status(500).json({ error: "Failed to update trip", detail: error });
  }
});

// ✅ DELETE a trip by ID (with validation)
router.delete("/:id", validateObjectId, async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.whatToExpect.deleteMany({ where: { tripId: id } });
    await prisma.tripDay.deleteMany({ where: { tripId: id } });
    await prisma.trip.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error("❌ Error deleting trip:", error);
    res.status(500).json({ error: "Failed to delete trip" });
  }
});

export default router;
