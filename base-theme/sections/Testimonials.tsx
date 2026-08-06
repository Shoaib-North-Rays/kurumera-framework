import { EditableSection, EditableRepeater, EditableText } from "@kurumera/editable";

/**
 * Customer testimonials — and the reference example of MERCHANT-EDITABLE
 * CONTENT in this theme.
 *
 * Everything here is editable by the merchant from the dashboard
 * (Themes → Edit content), with no developer and no rebuild:
 *
 *   EditableSection  — lets them hide the whole block
 *   EditableText     — the heading, and each quote/author
 *   EditableRepeater — lets them ADD, REMOVE and REORDER testimonials
 *                       (the per-item template below stays fixed in code —
 *                        they can only manage which items exist)
 *
 * COPY THIS PATTERN for any new content you add to a theme. Content written
 * as plain JSX — `<h2>Our story</h2>` — can never be edited by the merchant;
 * wrapping is the ONLY thing that makes a field editable. That's deliberate:
 * it's what stops a merchant from breaking your layout or code.
 *
 * Note the division of labour with lib/settings.ts: ThemeSettings covers a
 * fixed built-in set (colors, fonts, hero, value props, section titles) and
 * has its own side-panel editor. Don't wrap those. Use these components for
 * everything ThemeSettings doesn't already cover — which is anything you add.
 */
export function Testimonials() {
  return (
    <EditableSection field="home.testimonials.section" label="Testimonials" className="section">
      <EditableText
        field="home.testimonials.heading"
        defaultValue="What our customers say"
        as="h2"
        className="section__title"
      />
      <EditableRepeater
        field="home.testimonials.items"
        defaultItems={[
          { quote: "Arrived faster than I expected and the quality is genuinely lovely.", author: "Sara K." },
          { quote: "Easy to order, easy to return. I've bought three times now.", author: "Daniyal R." },
          { quote: "Exactly what was pictured. I'll be recommending them.", author: "Ayesha M." },
        ]}
        itemDefaults={{ quote: "Add a customer quote here.", author: "Customer name" }}
        className="testimonials"
        itemClassName="testimonial"
      >
        {(item) => (
          <>
            <EditableText
              field={item.fieldFor("quote")}
              defaultValue={item.data.quote}
              as="p"
              className="testimonial__quote"
            />
            <EditableText
              field={item.fieldFor("author")}
              defaultValue={item.data.author}
              as="cite"
              className="testimonial__author"
            />
          </>
        )}
      </EditableRepeater>
    </EditableSection>
  );
}
