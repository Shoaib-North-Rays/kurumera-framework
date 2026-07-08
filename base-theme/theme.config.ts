import { defineTheme } from "@kurumera/theme";

/**
 * Theme manifest. `kurumera theme check` reads this to validate the route
 * contract; the dashboard reads `settings` to render the merchant editor.
 */
export default defineTheme({
  name: "Kurumera Base",
  version: "0.1.0",
  framework: "nextjs",
  compatibility: { next: "^15.0.0", kurumera: "^0.1.0" },
  routes: ["home", "product", "collection", "cart", "search", "page"],
  settings: {
    colors: true,
    typography: true,
    productCards: true,
    navigation: true,
  },
});
