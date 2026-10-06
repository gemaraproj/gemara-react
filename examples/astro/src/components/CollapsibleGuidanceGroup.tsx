import { CollapsibleGroup } from "@gemara/react/interactive";
import { IdPrefixScope } from "@gemara/react/primitives";
import { GuidanceCatalog } from "@gemara/react/guidance-catalog";
import type { GuidanceCatalogData } from "@gemara/react";

interface Props {
  data: GuidanceCatalogData;
  groupId: string;
}

/** GuidanceCatalog twin of CollapsibleControlGroup: one group, client-toggled. */
export default function CollapsibleGuidanceGroup({ data, groupId }: Props) {
  const group = (data.groups ?? []).find((g) => g.id === groupId);
  if (!group) return null;
  const guidelines = (data.guidelines ?? []).filter((g) => g.group === groupId);

  return (
    <CollapsibleGroup label={`Toggle group: ${group.title}`} defaultOpen>
      <IdPrefixScope prefix="island-">
        <GuidanceCatalog.Group group={group} guidelines={guidelines} />
      </IdPrefixScope>
    </CollapsibleGroup>
  );
}
