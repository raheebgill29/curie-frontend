import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Curiouser",
  description: "Curious Buddy parent dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
