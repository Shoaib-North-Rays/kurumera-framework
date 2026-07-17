import type { SVGProps } from "react";
const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});
export const Search = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>);
export const Arrow = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const Chevron = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>);
export const Check = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>);
export const Heart = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 20s-7-4.6-9.3-9C1 7.7 2.6 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.4 0 5 3.2 3.3 6.5C19 15.4 12 20 12 20Z" /></svg>);
export const Download = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3v12M8 11l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>);
export const Star = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19.2l1-5.8L3.5 9.2l5.9-.9z" /></svg>);
export const Layers = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" /><path d="M3 12l9 4.5L21 12M3 16.5 12 21l9-4.5" /></svg>);
export const Grid = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>);
export const Desktop = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>);
export const Tablet = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M12 17h.01" /></svg>);
export const Mobile = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M12 17h.01" /></svg>);
export const Expand = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M8 21H4a1 1 0 0 1-1-1v-4M16 21h4a1 1 0 0 0 1-1v-4" /></svg>);
export const Bolt = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>);
export const Shield = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3 5 6v5c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>);
export const Cart = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M2 3h2l2.4 12.3a1 1 0 0 0 1 .7h9.3a1 1 0 0 0 1-.8L21 7H5.2" /></svg>);
export const Sliders = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="currentColor" /><circle cx="15" cy="12" r="2" fill="currentColor" /><circle cx="8" cy="18" r="2" fill="currentColor" /></svg>);
