import Link from "next/link";
import { Arrow, Bolt } from "@/components/Icons";
import { Reveal, RevealGroup, RevealLines } from "@/components/motion/Reveal";
import { BUILDER_ORIGIN } from "@/lib/registry";
import "@/app/footer.css";

/**
 * The footer is the last composition on every page, so it is built as one
 * rather than as a link grid with a copyright line.
 *
 * It was four equal columns inside the same 1280px box as every band above it,
 * on white, which meant the page did not end — it just stopped. Now it is the
 * page's second dark surface and its widest: a closing CTA at display size, the
 * navigation as a wide asymmetric field, and the wordmark set edge to edge
 * underneath.
 *
 * Only links that resolve to a real page (an earlier version pointed most of
 * these at /templates).
 */
const COLS = [
  {
    title: "Marketplace",
    links: [
      { label: "Browse templates", href: "/templates" },
      { label: "Free templates", href: "/templates/free" },
      { label: "Paid templates", href: "/templates/paid" },
      { label: "Most installed", href: "/templates?sort=installs" },
      { label: "Saved", href: "/saved" },
    ],
  },
  {
    title: "Creators",
    links: [
      { label: "For creators", href: "/creator" },
      { label: "Creator dashboard", href: "/creator" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "support@kurumera.com", href: "mailto:support@kurumera.com" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="wrap ft">
        {/* ── The close. Heading left, the two real next steps right. ── */}
        <div className="ft__cta">
          <RevealLines as="h2" className="ft__h ft-lines" lines={["Your next store", "starts here."]} />
          <Reveal variant="fade" className="ft__acts">
            <Link className="btn btn--primary btn--lg mi-arrow" href="/templates">
              Browse templates <Arrow />
            </Link>
            <a className="btn btn--ghost btn--lg" href={BUILDER_ORIGIN}>
              <Bolt /> Start building
            </a>
          </Reveal>
        </div>

        {/* ── Navigation field. The brand block holds column 1 and the three
            link columns are pushed to the right half, so the row reads as a
            masthead rather than four equal boxes. ── */}
        <div className="ft__nav">
          <div className="ft__brand">
            <Link href="/" className="ft__logo">
              <span className="brand__mark">K</span> Kurumera
            </Link>
            <p className="ft__tag">
              Professionally designed website templates you can customize without limits — then publish in a click.
            </p>
          </div>
          {COLS.map((c) => (
            <nav key={c.title} className="ft__col" aria-label={c.title}>
              <h3>{c.title}</h3>
              <ul>
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="ft__legal">
          <span>© {year} Kurumera. All rights reserved.</span>
          <span className="ft__legal-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </span>
        </div>
      </div>

      {/* ── The wordmark. Full bleed, clipped by the viewport at both ends, and
          aria-hidden — it is the brand set large, not a heading, and a screen
          reader has already had the name three times by this point. ── */}
      <RevealGroup className="ft__markwrap">
        <Reveal variant="mask" className="ft__mark" aria-hidden>
          Kurumera
        </Reveal>
      </RevealGroup>
    </footer>
  );
}
