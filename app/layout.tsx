import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diwakar Adhikari — 3D Portfolio",
  description:
    "Explore Diwakar Adhikari's resume as a cozy, walkable 3D town. Senior Software Engineer — Java, Angular, Node.js.",
  icons: { icon: "/ui/favicon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
