import { AVATAR_PAIRS, avatarVariant } from "../../lib/avatar.js";
import { initialOf } from "../../lib/utils.js";

export default function Avatar({ seed, name, src, size = "", className = "" }) {
  const variant = avatarVariant(seed ?? name);
  const [a, b] = AVATAR_PAIRS[variant];
  const classes = `avatar ${size} ${className}`.trim();

  if (src) {
    return <img className={classes} src={src} alt={name || ""} />;
  }
  return (
    <div className={classes} data-av={variant} style={{ "--a": a, "--b": b }}>
      {initialOf(name)}
    </div>
  );
}
