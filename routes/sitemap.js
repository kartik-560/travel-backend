import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const DOMAIN = "https://www.betterbackpackingindia.com";

const escapeXml = (unsafe) => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case "\"": return "&quot;";
      default: return c;
    }
  });
};

router.get("/", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Fetch all currently published itineraries from database
    const trips = await prisma.trip.findMany({
      where: {
        OR: [
          { status: "PUBLISHED" },
          { status: null },
          { status: { isSet: false } }
        ]
      },
      select: {
        id: true,
        title: true,
        updatedAt: true
      },
      orderBy: { updatedAt: "desc" }
    });

    const staticRoutes = [
      { path: "", changefreq: "daily", priority: "1.0" },
      { path: "/itinerary", changefreq: "daily", priority: "0.9" },
      { path: "/about", changefreq: "monthly", priority: "0.8" },
      { path: "/contact", changefreq: "monthly", priority: "0.8" },
      { path: "/testimonials", changefreq: "weekly", priority: "0.7" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static core pages
    for (const route of staticRoutes) {
      xml += `  <url>\n`;
      xml += `    <loc>${DOMAIN}${route.path}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
      xml += `    <priority>${route.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Dynamic Itinerary pages from MongoDB
    for (const trip of trips) {
      const lastmod = trip.updatedAt
        ? new Date(trip.updatedAt).toISOString().split("T")[0]
        : today;
      const tripUrl = `${DOMAIN}/travel_itinerary/${trip.id}/${encodeURIComponent(trip.title)}`;

      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(tripUrl)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.85</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>\n`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=600");
    return res.status(200).send(xml);
  } catch (error) {
    console.error("Error generating dynamic sitemap:", error);
    return res.status(500).send("Error generating sitemap");
  }
});

export default router;

