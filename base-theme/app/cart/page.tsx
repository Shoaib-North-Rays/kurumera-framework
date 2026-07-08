/** cart template */
export default function CartPage() {
  return (
    <section className="section">
      <h1 className="section__title">Your cart</h1>
      <p className="muted">
        Your cart is empty. Add products from the shop — the interactive cart drawer
        arrives with the client cart in P1.
      </p>
      <a className="btn" href="/search">
        Continue shopping
      </a>
    </section>
  );
}
