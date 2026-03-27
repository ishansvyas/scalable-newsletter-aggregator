import Link from "next/link";

const team = [
  {
    name: "Lucy",
    role: "",
    bio: "",
  },
  {
    name: "Ishan",
    role: "",
    bio: "",
  },
  {
    name: "Mekhi",
    role: "",
    bio: "",
  },
];

export default function About() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-foreground/5">
        <Link href="/" className="text-sm font-medium tracking-tight opacity-80 hover:opacity-100 transition-opacity">
          Limina
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/about"
            className="text-sm text-foreground transition-colors"
          >
            About
          </Link>
          <Link
            href="/login"
            className="text-sm text-foreground/50 hover:text-foreground transition-colors"
          >
            Sign in →
          </Link>
        </div>
      </nav>

      <main className="flex flex-1 flex-col items-center px-8 py-24 gap-20">
        {/* Title */}
        <div className="flex flex-col items-center gap-4 text-center max-w-lg">
          <p className="text-xs uppercase tracking-widest text-foreground/30">About</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Built by three people<br />
            <span className="text-foreground/40">who get too many emails.</span>
          </h1>
          <p className="text-sm text-foreground/50 leading-relaxed">
            Limina — <span className="font-mono text-foreground/30">L</span>ucy,{" "}
            <span className="font-mono text-foreground/30">I</span>shan &{" "}
            <span className="font-mono text-foreground/30">M</span>ekhi's{" "}
            <span className="font-mono text-foreground/30">I</span>ntelligent{" "}
            <span className="font-mono text-foreground/30">N</span>ewsletter{" "}
            <span className="font-mono text-foreground/30">A</span>ggregator — is a class project
            turned real tool, built to tame inbox overload with AI.
          </p>
        </div>

        {/* Team */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 max-w-2xl w-full">
          {team.map(({ name, role, bio }) => (
            <div key={name} className="flex flex-col gap-3 border border-foreground/5 rounded-2xl p-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-medium">{name}</h2>
                {role ? (
                  <p className="text-xs text-foreground/40">{role}</p>
                ) : (
                  <p className="text-xs text-foreground/20 italic">role · coming soon</p>
                )}
              </div>
              {bio ? (
                <p className="text-sm text-foreground/50 leading-relaxed">{bio}</p>
              ) : (
                <p className="text-sm text-foreground/20 italic leading-relaxed">Bio coming soon.</p>
              )}
            </div>
          ))}
        </div>

        {/* Project context */}
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <p className="text-xs uppercase tracking-widest text-foreground/30">The project</p>
          <p className="text-sm text-foreground/50 leading-relaxed">
            Limina was built for <strong className="text-foreground/70">The 9th Street Journal</strong>, a
            student publication in Durham, NC — and designed from day one to scale to any
            organization that publishes newsletters.
          </p>
          <p className="text-sm text-foreground/50 leading-relaxed">
            The pipeline runs on GitHub Actions, summarizes with GPT-4.1, and delivers
            clean digests every morning at 8 AM ET.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center px-8 py-6 border-t border-foreground/5">
        <p className="text-xs text-foreground/25">
          Limina · Lucy, Ishan & Mekhi's Intelligent Newsletter Aggregator
        </p>
      </footer>
    </div>
  );
}
