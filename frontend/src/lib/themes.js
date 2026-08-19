export const THEMES = [
  { id: "ivory_champagne", name: "Ivory & Champagne", desc: "Timeless, warm golden glow", swatches: ["#FBF9F5", "#C8A97E", "#2B2620", "#EDE5D8"] },
  { id: "blush_romance", name: "Blush Romance", desc: "Soft, romantic, warm", swatches: ["#FDF8F7", "#D48B91", "#332225", "#F2DCDD"] },
  { id: "sage_garden", name: "Sage Garden", desc: "Botanical, calm, fresh", swatches: ["#F7FAF7", "#5B7F61", "#1B2A1E", "#DDE8DE"] },
  { id: "midnight_elegant", name: "Midnight Elegant", desc: "Modern, dark, sophisticated", swatches: ["#0F141C", "#E2C392", "#F4F6F8", "#1E2633"] },
  { id: "dusty_blue", name: "Dusty Blue", desc: "Calm, modern, coastal", swatches: ["#F6F8FA", "#557B97", "#1D2833", "#DBE4EC"] },
  { id: "burgundy_love", name: "Burgundy Love", desc: "Rich, mature, luxurious", swatches: ["#FAF6F6", "#7A2032", "#2B1016", "#E8D0D5"] },
  { id: "terracotta_sunset", name: "Terracotta Sunset", desc: "Warm, intimate, boho", swatches: ["#FAF7F5", "#C15C3D", "#301A12", "#F0D7CB"] },
  { id: "lavender_dream", name: "Lavender Dream", desc: "Dreamy, soft, violet", swatches: ["#F9F7FB", "#8365A0", "#231B2C", "#E6DCF0"] },
];

export function applyTheme(id) {
  if (!id) return;
  document.documentElement.setAttribute("data-theme", id);
  try { localStorage.setItem("weddly_theme", id); } catch {}
}
