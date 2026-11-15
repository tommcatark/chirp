export const AVATAR_PAIRS = [
  ["#fcd34d", "#f472b6"],
  ["#6ee7b7", "#38bdf8"],
  ["#c4b5fd", "#f0abfc"],
  ["#fca5a5", "#fcd34d"],
  ["#7dd3fc", "#818cf8"],
  ["#34d399", "#0e9f6e"]
];

export function hashSeed(seed) {
  const text = String(seed ?? "?");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

export function colorsFor(seed) {
  return AVATAR_PAIRS[hashSeed(seed) % AVATAR_PAIRS.length];
}

export function avatarVariant(seed) {
  return hashSeed(seed) % AVATAR_PAIRS.length;
}
