import "./globals.css";

export const metadata = {
  title: "PR Forge",
  description: "Track weightlifting PRs, videos, progress, and friends.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PR Forge",
    statusBarStyle: "default"
  }
};

export const viewport = {
  themeColor: "#172033"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
