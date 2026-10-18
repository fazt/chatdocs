/** Vista previa estática del producto (ilustración de la landing, no datos reales). */
export function ProductPreview() {
  return (
    <div className="relative" aria-label="Ejemplo de respuesta de Folio con citas" role="img">
      <div aria-hidden className="pointer-events-none absolute -inset-12 -z-10 bg-radial-fade" />
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)] ring-1 ring-black/5 dark:ring-white/5">
        <div className="flex items-center justify-between border-b border-border/80 bg-ink px-4 py-2.5">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-rose/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-cream-soft/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/60" />
          </div>
          <span className="truncate font-mono text-[11px] text-muted-foreground">Andes Analítica · contratos 2026</span>
        </div>

        <div className="space-y-4 p-5 text-sm">
          <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-secondary px-3.5 py-2.5">
            ¿Con cuánta anticipación hay que avisar para no renovar el arrendamiento?
          </div>

          <div className="space-y-3 rounded-lg rounded-tl-sm border border-border/60 bg-background/60 px-3.5 py-3">
            <p className="text-pretty">
              El contrato se renueva solo por periodos de un año, salvo aviso con{" "}
              <span className="rounded bg-cream-soft/20 px-0.5">«una anticipación no menor de noventa días calendario a la fecha de vencimiento»</span>{" "}
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-cream-soft/50 px-1 font-mono text-[10px] text-cream">1</span>.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-2.5 py-1 font-mono text-mint">✔ cita verificada</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 font-mono text-muted-foreground">
                [1] Contrato de arrendamiento · pág. 2
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border/80 bg-ink/60 p-3 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-cream-soft">pág. 2 · cláusula segunda</p>
            …vencido el plazo, el contrato se renovará automáticamente por periodos sucesivos de un año, salvo que cualquiera de las partes comunique su
            voluntad de no renovarlo con <mark className="cite">una anticipación no menor de noventa días calendario a la fecha de vencimiento</mark>.
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/80 bg-ink px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
          <span>1 de 1 citas verificadas</span>
          <span className="hidden sm:inline">exportar · md · pdf</span>
        </div>
      </div>
    </div>
  );
}
