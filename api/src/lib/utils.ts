import crypto from "crypto";

export function uuid(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function first<T>(rows: T[]): T | undefined {
  return rows[0];
}
