import { Bebas_Neue, DM_Mono, DM_Sans } from "next/font/google";
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

export const metadata = {
  title: "Fast Food Audit — Profitability Calculator",
  description:
    "Estimate margins, food cost, break-even volume, and P&L for quick-service food businesses.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontMono.variable} ${fontSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
