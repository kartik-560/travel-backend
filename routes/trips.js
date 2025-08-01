import express from "express";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();
const router = express.Router();

router.get("/contact", async (req, res) => {
  try {
    const submissions = await prisma.contactFormSubmission.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(submissions);
  } catch (err) {
    console.error("❌ Error fetching contact submissions:", err);
    res.status(500).json({ error: "Failed to fetch contact submissions" });
  }
});

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


router.post("/contact", async (req, res) => {
  const { name, email, phone,message, } = req.body;
  console.log("📩 Contact form submission received:", { name, email,phone, message, });

  if (!name || !email || !phone || !message) {
  console.error("❌ Missing field(s)", { name, email, phone, message });
}
  try {
   
    const savedForm = await prisma.contactFormSubmission.create({
      data: { name, email, phone,message },
    });
    console.log("✅ Contact form saved to DB");

   
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: "kartikkanzode@gmail.com",
      subject: "New Travel Consultation Request",
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong> ${message}</p>
      `,
    };

    const mailResult = await transporter.sendMail(mailOptions);
    console.log("📤 Email sent:", mailResult.accepted);

    res.status(201).json({ message: "Form submitted and email sent" });
  } catch (err) {
    console.error("❌ FULL ERROR:", err.message, err);
    res.status(500).json({ error: "Failed to process contact form" });
  }
});

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
      category, 
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