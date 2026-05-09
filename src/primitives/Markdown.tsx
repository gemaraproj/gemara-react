export interface MarkdownProps {
  content: string | undefined;
  /** Optional element override — defaults to `<div>`. */
  as?: "div" | "p" | "section" | "article";
}

/**
 * Placeholder Markdown renderer.
 *
 * v0.1 deliberately renders plain text only — the spec emits Markdown in many
 * fields (objective, description, recommendations.text), but pulling in a
 * Markdown parser here would (a) bloat the bundle, (b) force a sanitization
 * decision on consumers, and (c) commit us to a specific dialect prematurely.
 *
 * When we swap this in for a real renderer (likely `marked` + `dompurify`
 * server-rendered, or a remark pipeline), the change is contained to this file
 * and the prop surface stays the same.
 *
 * For now: plain text inside the chosen element, preserving newlines via
 * CSS-targetable `white-space: pre-wrap` (consumers can override).
 */
export function Markdown({ content, as: As = "div" }: MarkdownProps) {
  if (!content) return null;
  return (
    <As data-gemara-markdown="" style={{ whiteSpace: "pre-wrap" }}>
      {content}
    </As>
  );
}
