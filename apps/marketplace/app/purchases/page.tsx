import { Purchases } from "@/components/Purchases";

export const metadata = {
  title: "Your purchases",
  robots: { index: false },
};

export default function PurchasesPage() {
  return <Purchases />;
}
