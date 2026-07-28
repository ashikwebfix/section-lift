import { createCookieSessionStorage, redirect } from "react-router";
import prisma from "./db.server";

const sessionSecret = process.env.SESSION_SECRET || "super-secret-default-key";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__superadmin_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
  },
});

export async function getSuperadminSession(request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}


export async function getSuperadminUser(request) {
  const session = await getSuperadminSession(request);
  const adminId = session.get("adminId");
  if (!adminId) return null;
  
  if (adminId === "superadmin") {
    return { id: "superadmin", name: "Master Admin", email: "master@admin", role: "MASTER" };
  }
  
  const user = await prisma.adminUser.findUnique({ where: { id: adminId } });
  return user;
}

export async function requireSuperadmin(request) {
  const session = await getSuperadminSession(request);
  if (!session.has("adminId")) {
    throw redirect("/superadmin/login");
  }
  return session;
}
