import { CreatorDashboard } from "@/components/CreatorDashboard";

export const metadata = { title: "Creator dashboard — Kurumera" };

export default function CreatorPage() {
  return (
    <>
      <section className="creator-hero">
        <div className="wrap creator-hero__inner">
          <div>
            <span className="eyebrow">Creator dashboard</span>
            <h1>Manage your templates</h1>
            <p>Edit pricing, descriptions and tags for the templates you&rsquo;ve published — changes go live on the marketplace instantly.</p>
          </div>
        </div>
      </section>
      <CreatorDashboard />
    </>
  );
}
