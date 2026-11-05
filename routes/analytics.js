import express from "express";
import prisma from "../prisma.js";
import { basicAuth, requireAdmin } from "../middleware/basicAuth.js";

const router = express.Router();

// Helper to determine device type from User-Agent
function detectDevice(userAgent = "") {
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

// Helper to detect Browser
function detectBrowser(userAgent = "") {
  if (/edg/i.test(userAgent)) return "Edge";
  if (/chrome|crios/i.test(userAgent)) return "Chrome";
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  if (/opr\//i.test(userAgent)) return "Opera";
  return "Other";
}

// Helper to detect OS
function detectOS(userAgent = "") {
  if (/windows/i.test(userAgent)) return "Windows";
  if (/macintosh|mac os x/i.test(userAgent)) return "macOS";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Other";
}

/**
 * POST /api/analytics/track
 * PUBLIC endpoint - called by travel-web frontend to log visitor impression
 */
router.post("/track", async (req, res) => {
  try {
    const { visitorId, path = "/", referrer = "direct", device, browser, os } = req.body || {};
    const userAgent = req.headers["user-agent"] || "";
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";

    const resolvedDevice = device || detectDevice(userAgent);
    const resolvedBrowser = browser || detectBrowser(userAgent);
    const resolvedOS = os || detectOS(userAgent);

    const impression = await prisma.visitorImpression.create({
      data: {
        visitorId: visitorId || `anon_${Math.random().toString(36).slice(2, 10)}`,
        path: typeof path === "string" ? path.slice(0, 200) : "/",
        referrer: typeof referrer === "string" ? referrer.slice(0, 300) : "direct",
        device: resolvedDevice,
        browser: resolvedBrowser,
        os: resolvedOS,
        ip: ip.replace("::ffff:", "").slice(0, 45),
        timestamp: new Date(),
      },
    });

    return res.status(201).json({ success: true, id: impression.id });
  } catch (error) {
    console.error("Analytics track error:", error);
    // Always return 200/204 to client so web app is unaffected by any tracking failure
    return res.status(200).json({ success: false });
  }
});

/**
 * GET /api/analytics/stats
 * PROTECTED endpoint - only admin can view impressions & statistics
 */
router.get("/stats", basicAuth, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Overall counts
    const [totalImpressions, todayImpressions, weekImpressions, monthImpressions] =
      await Promise.all([
        prisma.visitorImpression.count(),
        prisma.visitorImpression.count({ where: { timestamp: { gte: startOfToday } } }),
        prisma.visitorImpression.count({ where: { timestamp: { gte: sevenDaysAgo } } }),
        prisma.visitorImpression.count({ where: { timestamp: { gte: thirtyDaysAgo } } }),
      ]);

    // 2. Unique visitors
    const [allUnique, todayUnique] = await Promise.all([
      prisma.visitorImpression.findMany({
        distinct: ["visitorId"],
        select: { visitorId: true },
      }),
      prisma.visitorImpression.findMany({
        where: { timestamp: { gte: startOfToday } },
        distinct: ["visitorId"],
        select: { visitorId: true },
      }),
    ]);

    // 3. Top visited pages
    const topPagesRaw = await prisma.visitorImpression.groupBy({
      by: ["path"],
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 8,
    });
    const topPages = topPagesRaw.map((p) => ({
      path: p.path,
      views: p._count.path,
    }));

    // 4. Device breakdown
    const devicesRaw = await prisma.visitorImpression.groupBy({
      by: ["device"],
      _count: { device: true },
    });
    const deviceBreakdown = {
      desktop: 0,
      mobile: 0,
      tablet: 0,
    };
    devicesRaw.forEach((d) => {
      const key = (d.device || "desktop").toLowerCase();
      if (deviceBreakdown[key] !== undefined) {
        deviceBreakdown[key] = d._count.device;
      }
    });

    // 5. Browser breakdown
    const browsersRaw = await prisma.visitorImpression.groupBy({
      by: ["browser"],
      _count: { browser: true },
      orderBy: { _count: { browser: "desc" } },
      take: 5,
    });
    const topBrowsers = browsersRaw.map((b) => ({
      browser: b.browser || "Unknown",
      count: b._count.browser,
    }));

    // 6. Recent impressions log (last 50)
    const recent = await prisma.visitorImpression.findMany({
      take: 50,
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        visitorId: true,
        path: true,
        referrer: true,
        device: true,
        browser: true,
        os: true,
        ip: true,
        timestamp: true,
      },
    });

    // 7. Last 7 Days Timeline (for charts)
    const timeline = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);

      const [dayImpressions, dayUnique] = await Promise.all([
        prisma.visitorImpression.count({
          where: { timestamp: { gte: dayStart, lt: dayEnd } },
        }),
        prisma.visitorImpression.findMany({
          where: { timestamp: { gte: dayStart, lt: dayEnd } },
          distinct: ["visitorId"],
          select: { visitorId: true },
        }),
      ]);

      const dateLabel = dayStart.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      timeline.push({
        date: dayStart.toISOString().split("T")[0],
        label: dateLabel,
        impressions: dayImpressions,
        uniqueVisitors: dayUnique.length,
      });
    }

    res.json({
      summary: {
        totalImpressions,
        uniqueVisitors: allUnique.length,
        todayImpressions,
        todayUniqueVisitors: todayUnique.length,
        weekImpressions,
        monthImpressions,
      },
      topPages,
      deviceBreakdown,
      topBrowsers,
      timeline,
      recent,
    });
  } catch (error) {
    console.error("Failed to fetch analytics stats:", error);
    res.status(500).json({ error: "Failed to fetch analytics statistics" });
  }
});

/**
 * DELETE /api/analytics/clear
 * Admin action to reset visitor impressions if needed
 */
router.delete("/clear", basicAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.visitorImpression.deleteMany({});
    res.json({ message: "Analytics data successfully reset." });
  } catch (error) {
    console.error("Failed to clear analytics:", error);
    res.status(500).json({ error: "Failed to clear analytics" });
  }
});

export default router;

