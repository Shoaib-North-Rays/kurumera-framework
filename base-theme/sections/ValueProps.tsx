import { TruckIcon, RefreshIcon, ShieldIcon, HeadsetIcon } from "@/components/Icon";

const PROPS = [
  { Icon: TruckIcon, title: "Free shipping", text: "On qualifying orders" },
  { Icon: RefreshIcon, title: "Easy returns", text: "30-day money back" },
  { Icon: ShieldIcon, title: "Secure checkout", text: "Encrypted payments" },
  { Icon: HeadsetIcon, title: "Here to help", text: "Support any time" },
];

/** Trust/benefits bar — reassures shoppers. */
export function ValueProps() {
  return (
    <section className="valueprops">
      {PROPS.map(({ Icon, title, text }) => (
        <div key={title} className="valueprop">
          <Icon />
          <div>
            <b>{title}</b>
            <span>{text}</span>
          </div>
        </div>
      ))}
    </section>
  );
}
