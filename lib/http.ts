import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function parsePositiveNumber(value: unknown, fallback: number, label: string): number {
  const next = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isFinite(next) || next <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return next;
}
