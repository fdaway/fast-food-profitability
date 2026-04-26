import { Bebas_Neue, DM_Mono, DM_Sans, Inter } from "next/font/google";
import "./globals.css";

const fontDisplay = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-fd",
  display: "swap",
});

const fontMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-fm",
  display: "swap",
});

const fontSans = DM_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-fb",
  display: "swap",
});

const fontInter = Inter({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-fi",
  display: "swap",
});

export const metadata = {
  title: "Margin / Profit / Food Cost / Upsells / Projections — Calculator",
  description:
    "Model margin, profit, food cost, upsell add-ons, and volume/revenue projections with break-even and P&L for food businesses.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontMono.variable} ${fontSans.variable} ${fontInter.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
