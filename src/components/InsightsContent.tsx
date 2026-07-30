import type { ReactNode } from "react";

/** Negrito inline (**texto**) sem dangerouslySetInnerHTML. */
function renderInline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-white">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

interface InsightsContentProps {
  text: string;
}

/** Renderiza o markdown simples dos insights (## títulos, - bullets, **negrito**). */
export default function InsightsContent({ text }: InsightsContentProps) {
  const lines = text.split(/\r?\n/);

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed === "") return <div key={i} className="h-2" />;
        if (trimmed.startsWith("## ")) {
          return (
            <h4 key={i} className="font-semibold text-accent pt-2">
              {renderInline(trimmed.slice(3))}
            </h4>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          return (
            <p key={i} className="flex gap-2">
              <span className="text-accent shrink-0">•</span>
              <span>{renderInline(trimmed.slice(2))}</span>
            </p>
          );
        }
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}
