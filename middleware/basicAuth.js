import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function unauthorized(res) {
  res.setHeader("WWW-Authenticate", 'Basic realm="Restricted", charset="UTF-8"');
  return res.status(401).json({ error: "unauthorized" });
}

export async function basicAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Basic ")) return unauthorized(res);

    const base64 = header.slice(6).trim();
    let decoded;
    try {
      decoded = Buffer.from(base64, "base64").toString("utf8");
    } catch {
      return unauthorized(res);
    }

    const i = decoded.indexOf(":");
    if (i < 0) return unauthorized(res);

    const email = decoded.slice(0, i).trim();
    const password = decoded.slice(i + 1);

    if (!email || !password) return unauthorized(res);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) return unauthorized(res);

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  } catch (e) {
    console.error(e);
    return unauthorized(res);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}
