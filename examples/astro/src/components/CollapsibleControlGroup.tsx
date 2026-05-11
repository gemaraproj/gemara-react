import { CollapsibleGroup } from "@gemara/react/interactive";
import { ControlCatalog } from "@gemara/react/control-catalog";
import type { ControlCatalogData } from "@gemara/react";

interface Props {
  data: ControlCatalogData;
  groupId: string;
}

/**
 * Demonstrates a client island wrapping the (otherwise server-rendered)
 * ControlCatalog parts. The library's compound API lets us pluck just the
 * group view without rendering the rest of the tree.
 */
export default function CollapsibleControlGroup({ data, groupId }: Props) {
  const group = (data.groups ?? []).find((g) => g.id === groupId);
  if (!group) return null;
  const controls = (data.controls ?? []).filter((c) => c.group === groupId);

  return (
    <CollapsibleGroup label={`Toggle group: ${group.title}`} defaultOpen>
      <ControlCatalog.Group group={group} controls={controls} />
    </CollapsibleGroup>
  );
}
