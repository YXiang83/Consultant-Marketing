import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Consultant Marketing",
  description:
    "A mobile-first AI marketing consultant. Answer a few simple questions and get ready-to-publish copy and images.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-neutral-50 text-neutral-900">
        <div className="mx-auto flex min-h-full max-w-md flex-col bg-white shadow-[0_0_30px_rgba(0,0,0,0.04)]">
          {children}
        </div>
      </body>
    </html>
  );
}
