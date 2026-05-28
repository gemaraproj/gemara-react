// SPDX-License-Identifier: Apache-2.0
export interface DateTimeProps {
  /** ISO 8601 datetime string, as produced by Gemara's #Datetime format. */
  value: string | undefined;
  /**
   * Optional human-readable label override. If absent, the raw ISO string is
   * rendered as the visible text — consumers who want locale formatting can
   * pass their own.
   */
  children?: string;
}

/**
 * Renders an ISO 8601 datetime in a `<time>` element with a machine-readable
 * `datetime=` attribute. No locale formatting on purpose — that's a consumer
 * concern (and a server/client divergence hazard).
 */
export function DateTime({ value, children }: DateTimeProps) {
  if (!value) return null;
  return <time dateTime={value}>{children ?? value}</time>;
}
