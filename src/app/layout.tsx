import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { DomainProvider } from "@/components/domain-context";
import { AppShell } from "@/components/app-shell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AWS Batch JobTracker Dashboard",
  description: "Monitor and track AWS Batch jobs and scanning sessions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <AuthProvider>
          <DomainProvider>
            <AppShell>
              {children}
            </AppShell>
          </DomainProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
