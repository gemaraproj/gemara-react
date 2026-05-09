import { useContext } from "react";
import { GemaraContext, type LinkResolver } from "./GemaraProvider.js";

/**
 * Read the current LinkResolver from context.
 *
 * `useContext` is supported in both React 18 and 19 and is callable from
 * server components in React 19's RSC implementation. Keeping the API on the
 * stable hook surface lets us advertise `react >= 18` as a peer.
 */
export function useLinkResolver(): LinkResolver {
  return useContext(GemaraContext).linkResolver;
}
