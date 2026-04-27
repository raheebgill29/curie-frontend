import "./globals.css";
import PwaRegister from "./PwaRegister";
import Providers from "./providers";

export const metadata = {
  title: "Curiouser",
  description: "Curious Buddy parent dashboard",
  manifest: "/manifest.webmanifest",
  applicationName: "Curiouser",
  appleWebApp: {
    capable: true,
    title: "Curiouser",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
  },
};

export const viewport = {
  themeColor: "#3f4d51",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
