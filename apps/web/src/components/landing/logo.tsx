export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="relative inline-flex h-5 w-5 items-center justify-center">
        <span className="absolute inset-0 rounded-[5px] border border-cream-soft/60" />
        <span className="absolute inset-[3px] rounded-[2px] bg-cream-soft/15" />
        <span className="relative font-mono text-[10px] leading-none text-cream">›</span>
      </span>
      <span className="font-mono text-sm font-medium tracking-tight">
        chat<span className="text-cream-soft">docs</span>
      </span>
    </div>
  );
}
