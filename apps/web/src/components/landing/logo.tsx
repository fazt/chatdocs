export function Logo({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <span aria-hidden className="relative inline-flex h-5 w-5 items-center justify-center">
        <span className="absolute inset-0 rounded-[5px] border border-cream-soft/60" />
        <span className="absolute inset-[3px] rounded-[2px] bg-cream-soft/15" />
        <span className="relative font-serif-italic text-[12px] leading-none text-cream">f</span>
      </span>
      <span className="font-mono text-sm font-medium tracking-tight">
        fol<span className="text-cream-soft">io</span>
      </span>
    </span>
  );
}
