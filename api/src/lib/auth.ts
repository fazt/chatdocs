import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export const TOKEN_COOKIE = "chatdocs_token";
const TOKEN_NAME = TOKEN_COOKIE;
const SALT_ROUNDS = 10;

export type AuthPayload = {
  userId: string;
  email: string;
  role: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthPayload;
  } catch {
    return null;
  }
}

function cookieAttrs(): string {
  const parts = [
    `${TOKEN_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 7}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function setAuthCookie(token: string): string {
  return `${TOKEN_NAME}=${token}; ${cookieAttrs()}`;
}

export function removeAuthCookie(): string {
  const parts = [TOKEN_NAME, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  return parts.join("; ");
}
