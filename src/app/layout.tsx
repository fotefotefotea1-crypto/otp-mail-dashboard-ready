import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OTP Mail Dashboard",
  description: "Private dashboard for your authorized Outlook and Hotmail accounts",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
