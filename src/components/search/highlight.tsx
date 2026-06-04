import type { ReactNode } from "react";

export function highlightMatch(text: string, query?: string): ReactNode {
  const term = query?.trim().split(/\s+/)[0];
  if (!term) return text;
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="l-mark">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}
