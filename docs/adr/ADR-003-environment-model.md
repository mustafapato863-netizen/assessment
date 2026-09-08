# ADR-003: Environment Model

## Status
Approved 2026-09-04 (`admin`, Gate 3)

## Context
AssessFlow needs consistent behavior across development, testing, and production environments while allowing for environment-specific configuration (e.g., feature flags, resource sizing, third-party endpoints). The model must support safe testing of migrations, seamless promotion of changes, and clear separation of concerns.

## Decision
We will use a three-tier environment model with explicit promotion paths:
- **Development (local/dev):** Individual developer environments using Docker Compose with local PostgreSQL and Redis. Features may be enabled via feature flags; data is ephemeral and reset frequently.
- **Test (shared/stable):** A persistent environment for integration testing, performance testing, and stakeholder review. Matches production configuration as closely as possible (same database version, similar sizing). Used for pre-release validation.
- **Production:** The live environment serving the pilot user base. Follows strict change management procedures.

All environments share the same application code and infrastructure-as-code (Bicep modules). Configuration is managed through environment variables and/or a centralized configuration service (e.g., Azure App Configuration) with tier-specific values.

## Rationale
✅ **Consistency**: Reduces "works on my machine" issues by aligning test and production environments  
✅ **Safety**: Production-like environment for testing catches environment-specific bugs early  
✅ **Velocity**: Developers can work independently in local environments without affecting others  
✅ **Auditability**: Clear promotion path from dev → test → prod with versioned infrastructure  
✅ **Resource Optimization**: Development uses minimal resources; test and production scale as needed  

## Alternatives Considered
❌ **Two-tier (dev/prod only)**: No dedicated environment for integration/performance testing leads to production surprises  
❌ **Feature branching with shared database**: Risk of data contamination and complex branch-to-environment mapping  
❌ **Environment per pull request**: Overhead of provisioning full infrastructure for each PR; not sustainable for long-running branches  

## Implications
### Positive
- Environment-specific configuration is explicit and version-controlled
- Infrastructure changes tested in test environment before production promotion
- Clear rollback path: revert code and reapply previous infrastructure configuration
- Supports blue/green or canary deployments at the environment level

### Negative
- Requires discipline to avoid configuration drift between environments
- Test environment costs resources even when idle
- Initial setup effort for environment parity (e.g., matching database parameters)

### Mitigations
- Use infrastructure-as-code (Bicep) with parameter files per environment
- Implement automated environment drift detection (optional)
- Schedule regular test environment refreshes from production snapshot (anonymized)
- Document exact differences between environments (e.g., feature flags, logging levels)

## Related Decisions
- ADR-001: Modular monolith (deployment unit consistency)
- ADR-002: Host-vs-Standalone (configuration boundaries)
- Gate 3: Target architecture and deployment boundary (validation of environment model)
- Gate 4: Data model and migration readiness (migration testing in test environment)
- Gate 8: Test strategy and release evidence (use of test environment for validation)

## Notes
This decision assumes the ability to provision at least two separate environments (test and prod) in addition to local development. If resource constraints prevent a separate test environment, we may consider using namespaces or prefixes within a shared cluster, but strong isolation is preferred.