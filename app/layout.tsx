import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import prisma from "@/lib/prisma";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await prisma.config.findUnique({ where: { id: "global" } });
  return {
    title: config?.title || "Catálogo Web",
    description: "Catálogo de Moda",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await prisma.config.findUnique({ where: { id: "global" } });

  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen`}
      >
        {config?.maintenanceMode ? (
          <div className="min-h-screen flex items-center justify-center bg-black text-white text-center p-6">
            <div>
              <h1 className="text-4xl font-bold mb-4">Estamos en Mantenimiento</h1>
              <p className="text-zinc-400 text-lg">{config.maintenanceMsg}</p>
            </div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
