const FIRST = [
  "Jordan",
  "Riley",
  "Avery",
  "Cameron",
  "Quinn",
  "Sage",
  "Reese",
  "Rowan",
  "Skyler",
  "Harper",
  "Drew",
  "Morgan",
];

export function pickPartnerName() {
  return FIRST[Math.floor(Math.random() * FIRST.length)];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
