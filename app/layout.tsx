import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { Public_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SQL Agent",
  description: "Agentic implementation of a SQL Agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${publicSans.variable} ${spaceMono.variable} antialiased`}
      >
        <Toaster position="bottom-center" richColors />
        {children}
      </body>
    </html>
  );
}
