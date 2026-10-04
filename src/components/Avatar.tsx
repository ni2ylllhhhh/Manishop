interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  ring?: string;
  className?: string;
}

function getInitials(name?: string): string {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Avatar({ src, name, size = 40, ring, className = "" }: AvatarProps) {
  const style = { width: size, height: size };

  return (
    <div
      style={style}
      className={`shrink-0 overflow-hidden rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold select-none ${
        ring ? `ring-2 ${ring}` : ""
      } ${className}`}
    >
      {src ? (
        <img src={src} alt={name || "User"} className="h-full w-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 0.36 }}>{getInitials(name)}</span>
      )}
    </div>
  );
}
