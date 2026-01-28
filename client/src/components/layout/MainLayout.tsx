import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-4 lg:px-6 lg:py-8 flex-1 w-full">{children}</main>
      <Footer />
    </div>
  );
}
