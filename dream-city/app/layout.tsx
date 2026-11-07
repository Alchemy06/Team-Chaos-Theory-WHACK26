import type { Metadata, Viewport } from "next";
import { Pixelify_Sans, Silkscreen } from "next/font/google";
import "./globals.css";

const silkscreen = Silkscreen({ variable: "--font-silkscreen", weight: ["400", "700"], subsets: ["latin"] });
const pixelify = Pixelify_Sans({ variable: "--font-pixelify", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dream City",
  description: "A map of your mind, built from your dreams and the books, films, songs and games you love.",
};

export const viewport: Viewport = { themeColor: "#070b18", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${silkscreen.variable} ${pixelify.variable} h-full`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
