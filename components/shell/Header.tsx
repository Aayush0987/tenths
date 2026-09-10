import Link from "next/link";
import ThemeToggle from "@/components/shell/ThemeToggle";

/**
 * One thin bar. Everything else on a page is data, so the chrome stays out of
 * the way: no logo lockup, no hero, no colour that is not interactive.
 */
export default function Header() {
  return (
    <header
      className="flex items-center gap-5 px-4"
      style={{
        height: 40,
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <Link
        href="/"
        className="num shrink-0"
        style={{
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: "var(--ink)",
          textDecoration: "none",
          fontSize: "var(--text-small)",
        }}
      >
        TENTHS
      </Link>

      <nav className="header-nav" aria-label="Main">
        {[
          { href: "/2026", label: "2026" },
          { href: "/2025", label: "2025" },
          { href: "/2024", label: "2024" },
          { href: "/drivers", label: "DRIVERS" },
          { href: "/circuits", label: "CIRCUITS" },
        ].map(({ href, label }) => (
          <Link key={href} href={href} className="label" style={{ textDecoration: "none" }}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <span className="label header-range" style={{ color: "var(--ink-faint)" }}>
          2024–2026
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
