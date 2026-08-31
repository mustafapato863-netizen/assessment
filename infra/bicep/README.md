# AssessFlow Azure infrastructure

The production target is Azure managed services. The first infrastructure milestone must provision development and test environments before production:

- Azure Container Apps environment with private/internal ingress.
- Web/API Container App and internal worker Container App.
- Azure Database for PostgreSQL Flexible Server 18 with private networking and HA in production.
- Private Blob Storage with quarantine and clean containers.
- Azure Managed Redis.
- Key Vault, Application Insights/OpenTelemetry, and Azure Communication Services Email.
- Entra ID application registration and app roles.

Infrastructure should be added as reviewed Bicep modules after the Security and Operations owners approve region, networking, data residency, sizing, and budget. Do not commit real tenant IDs, secrets, connection strings, or production resource names.

`main.bicep` is the non-secret baseline for development/test topology. It deliberately leaves private endpoint wiring, Entra application registration, Defender for Storage, Azure Managed Redis sizing, and ACS Email sender verification as explicit deployment inputs/operations approvals rather than silently creating insecure defaults.
