import { signJwt } from "../../../lib/auth";

const ADMIN_EMAIL = "admin@eatout.com";
const ADMIN_PASSWORD = "password123";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const { email, password } = req.body || {};

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    res.status(401).json({ message: "Invalid credentials or not an admin" });
    return;
  }

  const token = await signJwt({
    sub: "admin-1",
    email,
    role: "admin"
  });

  res.setHeader("Set-Cookie", [
    `token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 2}`
  ]);

  res.status(200).json({
    user: { email, role: "admin" }
  });
}

