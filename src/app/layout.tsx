import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CoachMatching — Find Your Perfect Coach",
  description:
    "Connect with verified soccer coaches for personalized VOD reviews, tactical analysis, and 1-on-1 training. Secure escrow payments, pro-level feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className={`${inter.variable} font-sans antialiased text-slate-100 bg-[var(--bg-primary)] min-h-screen flex flex-col relative`}
      >
        {children}
      </body>
    </html>
  );
}
