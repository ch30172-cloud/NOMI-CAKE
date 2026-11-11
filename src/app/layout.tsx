import "./globals.css";

// The real <html>/<body> live in src/app/[locale]/layout.tsx so that lang/dir follow the locale.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
