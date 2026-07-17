export const metadata = {
  title: "Privacy Policy — Kurumera Templates",
  description: "How Kurumera Templates handles your data.",
};

export default function PrivacyPage() {
  return (
    <div className="wrap legal">
      <h1>Privacy Policy</h1>
      <p className="legal__meta">Last updated: {new Date().getFullYear()}</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Purchases.</b> When you buy a template we collect the email you provide, so we can send your receipt and license key. Payments are processed by Stripe — we never see or store your card details.</li>
        <li><b>Sign-in.</b> If you sign in as a creator, we use your Kurumera account session to authenticate you and show the listings you own. We don&rsquo;t store your password.</li>
        <li><b>Basic usage.</b> Standard server logs (IP, request time) for security and reliability.</li>
      </ul>

      <h2>What we don&rsquo;t do</h2>
      <ul>
        <li>We don&rsquo;t sell your data.</li>
        <li>We don&rsquo;t share your email with template creators beyond what&rsquo;s needed to fulfil a purchase.</li>
      </ul>

      <h2>Your choices</h2>
      <p>To request access to or deletion of your data, contact us at <a href="mailto:support@kurumera.com">support@kurumera.com</a>.</p>
    </div>
  );
}
