import "./globals.css";

export const metadata = {
  title: "Curiouser",
  description: "Curious Buddy parent dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
