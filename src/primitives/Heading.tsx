// SPDX-License-Identifier: Apache-2.0
import {
  createContext,
  useContext,
  type HTMLAttributes,
  type ReactNode,
} from "react";

const HeadingLevelContext = createContext<number>(1);

export interface HeadingScopeProps {
  /** Heading level (1-6) used as the base for nested `<Heading offset>` calls. */
  level: number;
  children: ReactNode;
}

export function HeadingScope({ level, children }: HeadingScopeProps) {
  return (
    <HeadingLevelContext.Provider value={level}>
      {children}
    </HeadingLevelContext.Provider>
  );
}

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Offset added to the ambient `<HeadingScope>` level. Result is clamped to [1, 6]. */
  offset?: number;
  children: ReactNode;
}

export function Heading({ offset = 0, children, ...rest }: HeadingProps) {
  const base = useContext(HeadingLevelContext);
  const raw = base + offset;
  const level = raw < 1 ? 1 : raw > 6 ? 6 : raw;
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return <Tag {...rest}>{children}</Tag>;
}
