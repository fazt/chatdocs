import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:5264";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Folio — Chat con documentos y citas verificables por página", template: "%s · Folio" },
  description:
    "Pregunta a tus contratos, políticas y papers. Folio responde con la cita literal y su página, verificada contra el documento. Compara documentos, extrae cláusulas y exporta respuestas con fuentes.",
  applicationName: "Folio",
  keywords: ["chat con documentos", "RAG", "contratos", "cumplimiento normativo", "investigación académica", "citas", "extracción de cláusulas"],
  openGraph: {
    type: "website",
    locale: "es_PE",
    siteName: "Folio",
    title: "Folio — Respuestas con la cita exacta y su página",
    description: "Chat con documentos para equipos legales, de cumplimiento e investigación. Cada respuesta trae la cita literal verificada.",
  },
  twitter: { card: "summary", title: "Folio", description: "Chat con documentos con citas verificables por página." },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

/** Aplica el tema antes de pintar (sin parpadeo): preferencia guardada o la del sistema. */
const themeScript = `(function(){try{var t=localStorage.getItem('folio-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
          Saltar al contenido
        </a>
        {children}
        <Toaster position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
