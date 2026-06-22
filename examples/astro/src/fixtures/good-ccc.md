# FINOS Cloud Control Catalog

Version: 2024.1

_FINOS Cloud Control Catalog_ is a Gemara 0.20.0 ControlCatalog by FINOS (Human, `finos`).

### Description

FINOS CCC is an open standard project that describes consistent controls for
compliant public cloud deployments in the financial services sector.

### Requirement Applicability Groups

The following groups are used to specify the circumstance within which an assessment requirement is mandated.

- **tlp_clear** — TLP:Clear: Information may be shared without restriction.

- **tlp_green** — TLP:Green: Information may be shared with partners and restricted to the
organization.

- **tlp_amber** — TLP:Amber: Information may be shared with partners and restricted to the
organization.

- **tlp_red** — TLP:Red: Information is restricted to the organization.

_Summary: 5 control(s), 10 assessment requirement(s)._

## Table of contents

- [Data Protection](#data-protection)
  - [CCC.C01: Prevent Unencrypted Requests](#ccc-c01-prevent-unencrypted-requests)
  - [CCC.C06: Prevent Deployment in Restricted Regions](#ccc-c06-prevent-deployment-in-restricted-regions)
  - [CCC.C08: Enable Multi-zone or Multi-region Data Replication](#ccc-c08-enable-multi-zone-or-multi-region-data-replication)
  - [CCC.C09: Prevent Tampering, Deletion, or Unauthorized Access to Access Logs](#ccc-c09-prevent-tampering-deletion-or-unauthorized-access-to-access-logs)
  - [CCC.C10: Prevent Data Replication to Destinations Outside of Defined
Trust Perimeter
](#ccc-c10-prevent-data-replication-to-destinations-outside-of-defined-trust-perimeter)

## data-protection: Data Protection

Data protection controls ensure that data is protected from unauthorized
access, disclosure, and tampering. This includes encryption of data at
rest and in transit, access controls, and data retention policies.

### CCC.C01: Prevent Unencrypted Requests

**Objective**

Ensure that all communications are encrypted in transit to protect data
integrity and confidentiality.

#### Guidelines

This control aids in the application of the following guidelines:

| Source | References |
| :--- | :--- |
| **CSF** | PR.DS-02 — Data-in-transit is protected |
| **CCM** | IVS-03 · IVS-07 |
| **ISO-27001** | 2013 A.13.1.1 — This control is closely related to 2013 A.13.1.1. |
| **NIST-800-53** | SC-8 · SC-13 |

#### Threats

This control aids in the mitigation of the following threats:

| Source | References |
| :--- | :--- |
| **CCC** | CCC.TH02 — Data is Intercepted in Transit |

#### CCC.C01.TR01

When a port is exposed for non-SSH network traffic, all traffic MUST
include a TLS handshake AND be encrypted using TLS 1.2 or higher.

**Applicability:** tlp_clear, tlp_green, tlp_amber, tlp_red

#### CCC.C01.TR02

When a port is exposed for SSH network traffic, all traffic MUST
include a SSH handshake AND be encrypted using SSHv2 or higher.

**Applicability:** tlp_clear, tlp_green, tlp_amber, tlp_red

### CCC.C06: Prevent Deployment in Restricted Regions

**Objective**

Ensure that resources are not provisioned or deployed in
geographic regions or cloud availability zones that have been
designated as restricted or prohibited, to comply with
regulatory requirements and reduce exposure to geopolitical
risks.

#### Guidelines

This control aids in the application of the following guidelines:

| Source | References |
| :--- | :--- |
| **CCM** | DSI-06 — This control is closely related to DSI-06. · DSI-08 — This control is closely related to DSI-08. |
| **ISO-27001** | 2013 A.11.1.1 — This control is closely related to 2013 A.11.1.1. |
| **NIST-800-53** | AC-6 — This control is closely related to AC-6. |
| **CSF** | PR.DS-1 — Data-at-rest is protected |

#### Threats

This control aids in the mitigation of the following threats:

| Source | References |
| :--- | :--- |
| **CCC** | CCC.TH03 — Deployment Region Network is Untrusted |

#### CCC.C06.TR01

When a deployment request is made, the service MUST validate
that the deployment region is not to a restricted or regions
or availability zones.

**Applicability:** tlp_clear, tlp_green, tlp_amber, tlp_red

#### CCC.C06.TR02

When a deployment request is made, the service MUST validate that
replication of data, backups, and disaster recovery operations
will not occur in restricted regions or availability zones.

**Applicability:** tlp_clear, tlp_green, tlp_amber, tlp_red

### CCC.C08: Enable Multi-zone or Multi-region Data Replication

**Objective**

Ensure that data is replicated across multiple
zones or regions to protect against data loss due to hardware
failures, natural disasters, or other catastrophic events.

#### Guidelines

This control aids in the application of the following guidelines:

| Source | References |
| :--- | :--- |
| **CSF** | PR.DS-5 — Protections against data leaks are implemented |
| **CCM** | BCR-08 — Backup |
| **NIST-800-53** | CP-2 — Contingency plan · CP-10 — Information system recovery and reconstitution |

#### Threats

This control aids in the mitigation of the following threats:

| Source | References |
| :--- | :--- |
| **CCC** | CCC.TH06 — Data is Lost or Corrupted |

#### CCC.C08.TR01

When data is stored, the service MUST ensure that data is
replicated across multiple availability zones or regions.

**Applicability:** tlp_green, tlp_amber, tlp_red

#### CCC.C08.TR02

When data is replicated across multiple zones or regions,
the service MUST be able to verify the replication state,
including the replication locations and data synchronization
status.

**Applicability:** tlp_green, tlp_amber, tlp_red

### CCC.C09: Prevent Tampering, Deletion, or Unauthorized Access to Access Logs

**Objective**

Access logs should always be considered sensitive.
Ensure that access logs are protected against unauthorized
access, tampering, or deletion.

#### Guidelines

This control aids in the application of the following guidelines:

| Source | References |
| :--- | :--- |
| **CCM** | LOG-02 — Audit log protection · LOG-04 — Audit log access and accountability · LOG-09 — Log protection |
| **NIST-800-53** | AU-9 — Protection of audit information |

#### Threats

This control aids in the mitigation of the following threats:

| Source | References |
| :--- | :--- |
| **CCC** | CCC.TH07 — Logs are Tampered with or Deleted · CCC.TH09 — Logs or Monitoring Data are Read by Unauthorized Users · CCC.TH04 — Data is Replicated to Untrusted or External Locations |

#### CCC.C09.TR01

When access logs are stored, the service MUST ensure that
access logs cannot be accessed without proper authorization.

**Applicability:** tlp_amber, tlp_red, tlp_green, tlp_clear

#### CCC.C09.TR02

When access logs are stored, the service MUST ensure that
access logs cannot be modified without proper authorization.

**Applicability:** tlp_amber, tlp_red, tlp_green, tlp_clear

#### CCC.C09.TR03

When access logs are stored, the service MUST ensure that
access logs cannot be deleted without proper authorization.

**Applicability:** tlp_amber, tlp_red, tlp_green, tlp_clear

### CCC.C10: Prevent Data Replication to Destinations Outside of Defined
Trust Perimeter

**Objective**

Prevent replication of data to untrusted destinations outside
of defined trust perimeter. An untrusted destination is defined
as a resource that exists outside of a specified trusted
identity or network or data perimeter.

#### Guidelines

This control aids in the application of the following guidelines:

| Source | References |
| :--- | :--- |
| **CSF** | PR.DS-5 — Protections against data leaks are implemented |
| **CCM** | DSP-10 — Sensitive data transfer · DSP-19 — Data location |
| **NIST-800-53** | AC-4 — Information flow enforcement |

#### Threats

This control aids in the mitigation of the following threats:

| Source | References |
| :--- | :--- |
| **CCC** | CCC.TH04 — Data is Replicated to Untrusted or External Locations |

#### CCC.C10.TR01

When data is replicated, the service MUST ensure that
replication is restricted to explicitly trusted destinations.

**Applicability:** tlp_green, tlp_amber, tlp_red

### Mapping References

- **CCC** — FINOS Common Cloud Controls Threats (v2024.1)
- **CSF** — NIST Cybersecurity Framework (v2.0)
- **CCM** — Cloud Security Alliance Cloud Controls Matrix (v4.0)
- **ISO-27001** — ISO/IEC 27001 (v2013)
- **NIST-800-53** — NIST Special Publication 800-53 (vRev. 5)

