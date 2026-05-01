import type { Metadata } from "next";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "kaWhat — Quiz App",
  description: "Kahoot-style multiplayer quiz app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body className="antialiased min-h-screen">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
