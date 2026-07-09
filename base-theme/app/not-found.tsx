import Link from "next/link";

/** 404 template */
export default function NotFound() {
  return (
    <section className="section" style={{ textAlign: "center", padding: "64px 16px" }}>
      <h1 className="section__title">Page not found</h1>
      <p className="muted">The page you’re looking for doesn’t exist.</p>
      <Link className="btn" href="/">
        Back to home
      </Link>
    </section>
  );
}
