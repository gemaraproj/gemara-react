export interface ProseProps {
  content: string | undefined;
  /** Optional element override — defaults to `<div>`. */
  as?: "div" | "p" | "section" | "article";
}

/**
 * Plain-text prose primitive.
 *
 * v1 contract: the catalog text fields (`objective`, `description`,
 * `front-matter`, `recommendations.text`, etc.) are rendered as plain text with
 * `white-space: pre-wrap` to preserve authored line breaks. The Gemara CUE
 * schema does not type any of these fields as Markdown — that's only a
 * convention — so this library makes no parsing promise.
 *
 * If a consumer needs rich formatting, there are two clean seams:
 *   - component-level: swap this primitive's implementation behind the same
 *     prop surface (e.g. `marked` + `dompurify` SSR, or a remark pipeline).
 *   - data-level: pre-render Markdown to sanitized HTML upstream (e.g. in
 *     go-gemara) and ship a new field alongside the source.
 *
 * Either path is deferred until a concrete consumer asks for it.
 */
export function Prose({ content, as: As = "div" }: ProseProps) {
  if (!content) return null;
  return (
    <As data-gemara-prose="" style={{ whiteSpace: "pre-wrap" }}>
      {content}
    </As>
  );
}
