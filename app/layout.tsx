import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kairo | Preventive Healthcare Companion",
  description:
    "Kairo is a gamified, AI-powered healthcare assistant that predicts and prevents lifestyle diseases using real-time fitness data, trusted sources, and daily habit challenges.",
  keywords: [
    "Kairo",
    "preventive healthcare",
    "lifestyle disease prediction",
    "AI health assistant",
    "health gamification",
    "fitness data insights",
    "digital health",
  ],
  applicationName: "Kairo",
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lexend.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
