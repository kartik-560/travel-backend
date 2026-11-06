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
    const { all, search, category, skip, limit, byCategory, limitPerCategory } = req.query;

    const baseStatusFilter =
      all === "true"
        ? []
        : [
            {
              OR: [
                { status: "PUBLISHED" },
                { status: null },
                { status: { isSet: false } },
              ],
            },
          ];

    const andConditions = [...baseStatusFilter];

    if (search && search.trim()) {
      const term = search.trim();
      andConditions.push({
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { subTitle: { contains: term, mode: "insensitive" } },
          { category: { contains: term, mode: "insensitive" } },
          { startPoint: { contains: term, mode: "insensitive" } },
          { endPoint: { contains: term, mode: "insensitive" } },
          { difficulty: { contains: term, mode: "insensitive" } },
          { travel_description: { contains: term, mode: "insensitive" } },
        ],
      });
    }

    if (category && category !== "All") {
      andConditions.push({
        category: { equals: category.trim(), mode: "insensitive" },
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    // 1. Grouped by category with limit per category (e.g. /api/trips?byCategory=true&limitPerCategory=3)
    if (byCategory === "true") {
      const perCatLimit = Math.max(1, parseInt(limitPerCategory, 10) || 3);

      const allMatching = await prisma.trip.findMany({
        where,
        include: {
          whatToExpect: true,
          days: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const groups = {};
      allMatching.forEach((trip) => {
        const catName = trip.category || "Uncategorized";
        if (!groups[catName]) {
          groups[catName] = [];
        }
        groups[catName].push(trip);
      });

      const categoriesResult = Object.entries(groups).map(([catName, tripList]) => {
        const totalCount = tripList.length;
        const slicedTrips = tripList.slice(0, perCatLimit);
        return {
          category: catName,
          totalCount,
          hasMore: totalCount > perCatLimit,
          trips: slicedTrips,
        };
      });

      return res.json({
        categories: categoriesResult,
        totalTrips: allMatching.length,
      });
    }

    // 2. Specific category pagination (e.g. /api/trips?category=...&skip=3&limit=6)
    if (category && (skip !== undefined || limit !== undefined)) {
      const skipNum = parseInt(skip, 10) || 0;
      const takeNum = parseInt(limit, 10) || 3;

      const [trips, totalCount] = await Promise.all([
        prisma.trip.findMany({
          where,
          include: {
            whatToExpect: true,
            days: true,
          },
          orderBy: { createdAt: "desc" },
          skip: skipNum,
          take: takeNum,
        }),
        prisma.trip.count({ where }),
      ]);

      return res.json({
        category,
        trips,
        totalCount,
        hasMore: totalCount > skipNum + trips.length,
      });
    }

    // 3. Standard query (with optional search, skip, limit)
    const queryOptions = {
      where,
      include: {
        whatToExpect: true,
        days: true,
      },
      orderBy: { createdAt: "desc" },
    };

    if (skip !== undefined) queryOptions.skip = parseInt(skip, 10);
    if (limit !== undefined) queryOptions.take = parseInt(limit, 10);

    const trips = await prisma.trip.findMany(queryOptions);
    res.json(trips);
  } catch (error) {
    console.error("❌ Error fetching trips:", error);
    res.status(500).json({ error: "Failed to fetch trips" });
  }
});

router.post("/contact", async (req, res) => {
  const { name, email, phone, message } = req.body || {};

  console.log("📩 Contact form submission received:", {
    name,
    email,
    phone,
    messageSnippet: typeof message === "string" ? message.slice(0, 60) : message,
  });

  // 1. Validate Name
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({
      error: "Please enter your full name (at least 2 characters).",
    });
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    return res.status(400).json({
      error: "Name is too long (maximum 100 characters).",
    });
  }

  // 2. Validate Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
    return res.status(400).json({
      error: "Please provide a valid email address (e.g., name@example.com).",
    });
  }
  const trimmedEmail = email.trim().toLowerCase();

  // 3. Validate Phone (min 10 digits)
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({
      error: "Please provide your phone or WhatsApp number.",
    });
  }
  const trimmedPhone = phone.trim();
  const digitsOnly = trimmedPhone.replace(/[^0-9]/g, "");
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return res.status(400).json({
      error: "Please provide a valid phone or WhatsApp number (at least 10 digits).",
    });
  }

  // 4. Validate Message
  if (!message || typeof message !== "string" || message.trim().length < 5) {
    return res.status(400).json({
      error: "Please provide a brief message describing your travel plans (minimum 5 characters).",
    });
  }
  const trimmedMessage = message.trim();
  if (trimmedMessage.length > 4000) {
    return res.status(400).json({
      error: "Message is too long (maximum 4000 characters).",
    });
  }

  try {
    // 5. Save verified submission to Database
    const savedForm = await prisma.contactFormSubmission.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        message: trimmedMessage,
      },
    });
    console.log("✅ Contact form saved to DB with ID:", savedForm.id);

    // 6. Attempt Email notification via Nodemailer (graceful fallback if SMTP fails)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const mailOptions = {
          from: process.env.SMTP_USER,
          to: "betterpackingindia@gmail.com, betterbackpackingindia@gmail.com",
          subject: `New Travel Consultation Request from ${trimmedName}`,
          html: `
            <h3>New Contact Form Submission</h3>
            <p><strong>Name:</strong> ${trimmedName}</p>
            <p><strong>Email:</strong> <a href="mailto:${trimmedEmail}">${trimmedEmail}</a></p>
            <p><strong>Phone:</strong> <a href="tel:${trimmedPhone}">${trimmedPhone}</a></p>
            <p><strong>Message / Preferences:</strong></p>
            <blockquote style="background:#f9f9f9;border-left:4px solid #f97316;padding:10px 14px;margin:8px 0;white-space:pre-wrap;">${trimmedMessage}</blockquote>
            <p style="color:#888;font-size:12px;">Submitted at: ${new Date().toLocaleString()}</p>
          `,
        };

        const mailResult = await transporter.sendMail(mailOptions);
        console.log("📤 Email notification sent:", mailResult.accepted);
      } catch (mailErr) {
        console.warn("⚠️ Email alert could not be sent, but form is saved to DB:", mailErr.message);
      }
    } else {
      console.log("ℹ️ SMTP credentials not set; skipped email notification.");
    }

    return res.status(201).json({
      message: "Thank you! Your travel consultation request has been received.",
      id: savedForm.id,
    });
  } catch (err) {
    console.error("❌ Database Error saving contact submission:", err.message, err);
    return res.status(500).json({
      error: "Failed to process contact form. Please try again or reach out on WhatsApp.",
    });
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
      status,
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
        status: status || "PUBLISHED",
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
      status,
    } = req.body;

    const expectList = Array.isArray(what_to_expect) ? what_to_expect : [];
    const dayList = Array.isArray(days) ? days : [];
    const updateData = {
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
        create: expectList.map((x) => ({
          expect_title: x.expect_title ?? "",
          expect_description: x.expect_description ?? "",
        })),
      },
      days: {
        create: dayList.map((d) => ({
          day: Number.isFinite(+d.day) ? +d.day : 0,
          description: d.description ?? "",
          distance: d.distance ?? "",
          duration: d.duration ?? "",
          highlights: Array.isArray(d.highlights)
            ? d.highlights
            : d.highlights
            ? String(d.highlights)
                .split(",")
                .map((s) => s.trim())
            : [],
        })),
      },
    };

    if (status !== undefined) {
      updateData.status = status;
    }

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: updateData,
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

// Quick toggle status: PUBLISHED vs HIDDEN
router.patch("/:id/status", validateObjectId, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const updated = await prisma.trip.update({
      where: { id },
      data: {
        status: status === "HIDDEN" ? "HIDDEN" : "PUBLISHED",
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("❌ Error updating trip status:", error);
    res.status(500).json({ error: "Failed to update trip status" });
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
