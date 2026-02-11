import { SignJWT, jwtVerify } from "jose";

const secretKey = process.env.JWT_SECRET || "dev_eatout_dashboard_secret_change_me";
const encodedKey = new TextEncoder().encode(secretKey);

export async function signJwt(payload, expiresIn = "2h") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodedKey);
}

export async function verifyJwt(token) {
  try {
    const { payload } = await jwtVerify(token, encodedKey);
    return payload;
  } catch {
    return null;
  }
}

