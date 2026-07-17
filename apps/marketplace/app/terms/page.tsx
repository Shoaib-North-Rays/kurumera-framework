export const metadata = {
  title: "Terms of Service — Kurumera Templates",
  description: "The terms for using Kurumera Templates and licensing templates.",
};

export default function TermsPage() {
  return (
    <div className="wrap legal">
      <h1>Terms of Service</h1>
      <p className="legal__meta">Last updated: {new Date().getFullYear()}</p>

      <h2>Templates &amp; licenses</h2>
      <ul>
        <li><b>Free templates</b> may be installed and customized for your own stores.</li>
        <li><b>Paid templates</b> require a valid license key, issued after a completed purchase. Your license lets you install and clone the template&rsquo;s source to build and customize your site.</li>
        <li>Don&rsquo;t redistribute or resell a template&rsquo;s source as your own.</li>
      </ul>

      <h2>Purchases</h2>
      <p>Payments are handled by Stripe. Prices are set by the template&rsquo;s creator and shown before checkout. Keep your license key — you&rsquo;ll need it to install or re-install the template.</p>

      <h2>For creators</h2>
      <p>You&rsquo;re responsible for the templates you publish and the accuracy of their listing (name, description, price, category). You retain ownership of your work; publishing lists it for others to install under these terms.</p>

      <h2>Availability</h2>
      <p>The marketplace is provided as-is. We may update or remove listings that violate these terms.</p>

      <p>Questions? <a href="mailto:support@kurumera.com">support@kurumera.com</a>.</p>
    </div>
  );
}
