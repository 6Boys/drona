import type { SupportCard as SupportCardData } from "@/lib/types";

/** Crisis routing (PRD 10). The copy here is whatever the API sent, rendered
 * plainly: no mascot, no rounded-cute framing, no rewriting. Cuteness in a
 * safety flow reads as manipulation and undermines the one surface that has to
 * be trusted. */
export function SupportCard({ card }: { card: SupportCardData }) {
  return (
    <section className="rounded-[var(--r-lg)] border border-border-strong bg-surface p-5">
      <h2 className="text-[0.9375rem] font-medium text-text">{card.title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{card.body}</p>

      <ul className="mt-4 space-y-3">
        {card.helplines.map((line) => (
          <li key={line.number} className="border-t border-border pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className="text-sm font-medium text-text">{line.name}</span>
              <a href={`tel:${line.number}`} className="font-mono text-sm text-accent-hi hover:underline">
                {line.number}
              </a>
              <span className="text-xs text-faint">{line.hours}</span>
            </div>
            <p className="mt-0.5 text-[0.8125rem] text-muted">{line.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
