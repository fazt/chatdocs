import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:5264";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/precios"], disallow: ["/app", "/api", "/pago", "/restablecer", "/invitacion"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
