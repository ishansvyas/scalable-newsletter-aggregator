import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-foreground/5">
        <span className="text-sm font-medium tracking-tight opacity-80">briefd</span>
        <Link
          href="/login"
          className="text-sm text-foreground/50 hover:text-foreground transition-colors"
        >
          Sign in →
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-8 text-center gap-8">
        {/* Subtle pulse dot */}
        <div className="relative flex items-center justify-center w-12 h-12">
          <span className="absolute inline-flex h-full w-full rounded-full bg-foreground/5 animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-foreground/20" />
        </div>

        <div className="flex flex-col gap-4 max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            Your newsletters,<br />
            <span className="text-foreground/40">distilled daily.</span>
          </h1>
          <p className="text-base text-foreground/50 leading-relaxed">
            briefd reads your newsletters, extracts what matters, and delivers
            a clean digest — automatically, every morning.
          </p>
        </div>

        <div className="flex items-center gap-4 mt-2">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-80 transition-opacity"
          >
            Get started
          </Link>
          <a
            href="#how-it-works"
            className="text-sm text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            How it works
          </a>
        </div>
      </main>

      {/* How it works */}
      <section
        id="how-it-works"
        className="flex flex-col items-center gap-12 px-8 py-24 border-t border-foreground/5"
      >
        <p className="text-xs uppercase tracking-widest text-foreground/30">How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 max-w-2xl w-full text-center">
          {[
            {
              step: "01",
              title: "Connect your inbox",
              body: "Link a Gmail address that receives your newsletters.",
            },
            {
              step: "02",
              title: "AI reads everything",
              body: "Every morning, the pipeline fetches and summarizes each newsletter.",
            },
            {
              step: "03",
              title: "One clean digest",
              body: "A single email lands in your inbox with only the highlights.",
            },
          ].map(({ step, title, body }) => (
            <div key={step} className="flex flex-col gap-2">
              <span className="text-xs font-mono text-foreground/20">{step}</span>
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="text-sm text-foreground/40 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="flex items-center justify-center px-8 py-6 border-t border-foreground/5">
        <p className="text-xs text-foreground/25">
          briefd · built for The 9th Street Journal and beyond
        </p>
      </footer>
    </div>
  );
}
