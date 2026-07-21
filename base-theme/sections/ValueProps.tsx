import type { SVGProps, ReactElement } from "react";
import { TruckIcon, RefreshIcon, ShieldIcon, HeadsetIcon, StarIcon, MailIcon } from "@/components/Icon";
import type { ValueProp } from "@/lib/settings";

/** Icon-name → component. The customizer offers these keys. */
const ICONS: Record<string, (p: SVGProps<SVGSVGElement>) => ReactElement> = {
  truck: TruckIcon,
  refresh: RefreshIcon,
  shield: ShieldIcon,
  headset: HeadsetIcon,
  star: StarIcon,
  mail: MailIcon,
};

/** Trust/benefits bar — reassures shoppers. Content comes from theme settings. */
export function ValueProps({ items }: { items: ValueProp[] }) {
  if (!items?.length) return null;
  return (
    <section className="valueprops">
      {items.map((p, i) => {
        const Icon = ICONS[p.icon] ?? StarIcon;
        return (
          <div key={i} className="valueprop">
            <Icon />
            <div>
              <b>{p.title}</b>
              <span>{p.text}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
