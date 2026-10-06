// SPDX-License-Identifier: Apache-2.0
import { createContext, useContext, type ReactNode } from "react";

const IdPrefixContext = createContext<string>("");

export interface IdPrefixScopeProps {
  prefix?: string;
  children: ReactNode;
}

export function IdPrefixScope({ prefix = "", children }: IdPrefixScopeProps) {
  return <IdPrefixContext.Provider value={prefix}>{children}</IdPrefixContext.Provider>;
}

export function useIdPrefix(): string {
  return useContext(IdPrefixContext);
}
