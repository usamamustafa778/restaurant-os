export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  res.setHeader("Set-Cookie", [
    "token=; Path=/; HttpOnly; Max-Age=0; Secure; SameSite=Lax"
  ]);

  res.status(200).json({ message: "Logged out" });
}

