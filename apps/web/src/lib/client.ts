const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
  });
  return res;
}
