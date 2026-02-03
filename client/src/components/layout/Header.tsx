import { Link, useLocation } from "wouter";
import { Eye, Menu, X, Github } from "lucide-react";
import { AuthButton } from "@/components/auth/AuthButton";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/context/AuthProvider";
import { useEffect, useState } from "react";

export function Header() {
  const [location] = useLocation();
  const { user } = useAuthContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/history", label: "History" },
    { path: "/templates", label: "Templates" },
    { path: "/settings", label: "Settings" },
  ];

  // Log header mount for debugging layout issues across environments
  useEffect(() => {
    console.debug("[Header] Mounted", { userPresent: Boolean(user) });
  }, [user]);

  return (
    <header className="border-b border-oracle-border bg-white shadow-sm relative">
      {/* Viewport-aligned: Logo on the far left (all breakpoints). Hidden on mobile when menu is open to avoid overlaying dropdown. */}
      <div className={`absolute inset-y-0 left-0 items-center pl-4 lg:pl-6 ${isMobileMenuOpen ? "hidden xl:flex" : "flex"}`}>
        <Link href="/" className="flex items-center space-x-3" data-testid="logo-link">
          <h1 className="text-lg lg:text-xl font-bold oracle-heading tracking-wide">DATAQUILT</h1>
        </Link>
        {/* GitHub repository button: compact, outlined button with primary-colored border and icon + label */}
        <Button
          asChild
          size="compact"
          variant="outline"
          className="ml-3 hidden xl:inline-flex border-2 border-oracle-accent text-oracle-accent bg-transparent hover:bg-oracle-accent/5"
          onClick={() =>
            console.debug("[Header] Click: GitHub repository", {
              source: "header_brand",
            })
          }
        >
          <a
            href="https://github.com/dessentialist/DataQuilt"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the DataQuilt GitHub repository in a new tab"
            aria-description="Opens the official DataQuilt source code repository on GitHub in a new browser tab"
            data-testid="github-link"
            className="inline-flex items-center gap-1"
            title="DataQuilt GitHub repository"
          >
            <Github className="w-4 h-4" />
            <span className="text-xs font-medium">GitHub Repo</span>
          </a>
        </Button>
      </div>

      {/* Viewport-aligned: How It Works + Auth on the far right (desktop only, xl+) */}
      <div className="hidden xl:flex absolute inset-y-0 right-0 items-center gap-6 pr-4 lg:pr-6">
        <Link
          href="/how-it-works"
          data-testid="nav-how-it-works"
          className={`font-medium transition-colors hover:text-oracle-accent text-sm uppercase tracking-wide ${
            location === "/how-it-works" ? "oracle-primary border-b-2 border-oracle-accent pb-1" : "oracle-muted"
          }`}
          onClick={() => console.debug("[Header] Click: How It Works")}
        >
          How It Works
        </Link>
        <AuthButton />
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        {/* Container-aligned row: main nav centered, mobile actions on right */}
        <div className="grid grid-cols-1 xl:grid-cols-3 items-center h-16">
          {/* Left column placeholder (desktop): keeps center nav visually centered */}
          <div className="hidden xl:flex"></div>

          {/* Center: Main navigation group (desktop only, xl+) */}
          <nav className="hidden xl:flex items-center justify-center space-x-12">
            {navItems.map(({ path, label }) => (
              <Link
                key={path}
                href={path}
                data-testid={`nav-${label.toLowerCase()}`}
                className={`font-medium transition-colors hover:text-oracle-accent text-sm uppercase tracking-wide ${
                  location === path ? "oracle-primary border-b-2 border-oracle-accent pb-1" : "oracle-muted"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right: mobile menu button (mobile); desktop actions are handled by the absolute container */}
          <div className="flex justify-end xl:hidden">
            <button
              className="p-2"
              onClick={() => {
                console.debug("[Header] Toggle mobile menu", { open: !isMobileMenuOpen });
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              data-testid="button-mobile-menu"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="xl:hidden border-t border-oracle-border py-4">
            <nav className="flex flex-col space-y-3">
              {/* GitHub repository button (mobile): pinned at the top of the open hamburger menu */}
              <div className="px-2">
                <Button
                  asChild
                  size="compact"
                  variant="outline"
                  className="w-full justify-center border-2 border-oracle-accent text-oracle-accent bg-transparent hover:bg-oracle-accent/5"
                  onClick={() => {
                    console.debug("[Header] Click: GitHub repository", {
                      source: "mobile_menu",
                    });
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <a
                    href="https://github.com/dessentialist/DataQuilt"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open the DataQuilt GitHub repository in a new tab"
                    aria-description="Opens the official DataQuilt source code repository on GitHub in a new browser tab"
                    data-testid="mobile-github-link"
                    className="inline-flex items-center gap-1"
                    title="DataQuilt GitHub repository"
                  >
                    <Github className="w-4 h-4" />
                    <span className="text-xs font-medium">DataQuilt GitHub Repo</span>
                  </a>
                </Button>
              </div>

              {/* How It Works - Public Page */}
              <Link
                href="/how-it-works"
                data-testid="mobile-nav-how-it-works"
                className={`font-medium transition-colors hover:text-oracle-accent text-sm uppercase tracking-wide px-2 py-2 rounded ${
                  location === "/how-it-works" 
                    ? "oracle-primary bg-oracle-accent/10 border-l-2 border-oracle-accent" 
                    : "oracle-muted"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                How It Works
              </Link>
              
              {/* Divider */}
              <div className="border-t border-oracle-border/50 my-2"></div>
              
              {/* Authenticated Pages */}
              {navItems.map(({ path, label }) => (
                <Link
                  key={path}
                  href={path}
                  data-testid={`mobile-nav-${label.toLowerCase()}`}
                  className={`font-medium transition-colors hover:text-oracle-accent text-sm uppercase tracking-wide px-2 py-2 rounded ${
                    location === path 
                      ? "oracle-primary bg-oracle-accent/10 border-l-2 border-oracle-accent" 
                      : "oracle-muted"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <div className="pt-3 border-t border-oracle-border">
                <AuthButton />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
