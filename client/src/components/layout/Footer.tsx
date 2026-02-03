import { Mail, Coffee } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-oracle-border">
      <div className="max-w-7xl mx-auto px-4 py-10 lg:px-6">
        <div className="flex items-center justify-center gap-6 flex-wrap text-center">
          <p className="oracle-muted text-sm leading-relaxed">
            Any and all suggestions are welcome! Please tell me how I can make this more
            useful for you by emailing me at d at dessentialist dot com
          </p>

          <a
            href="mailto:d@dessentialist.com"
            className="inline-flex items-center text-oracle-accent hover:text-oracle-accent/80"
            aria-label="Send email"
            title="Email"
          >
            <Mail size={20} />
          </a>

          <a
            href="https://www.buymeacoffee.com/darpanshah"
            className="inline-flex items-center gap-2 rounded-full bg-[#521948] text-white px-4 py-2 shadow-sm hover:bg-[#6a2260] transition-colors"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Coffee size={18} className="text-[#FFDD00]" />
            <span className="font-medium">Buy me a coffee</span>
          </a>
        </div>
      </div>
    </footer>
  );
}


