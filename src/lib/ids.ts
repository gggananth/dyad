const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function uid() {
  return crypto.randomUUID();
}

export function joinCode(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
