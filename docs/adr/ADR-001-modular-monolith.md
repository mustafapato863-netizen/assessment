# ADR-001: Modular Monolith Architecture

## Status
Approved 2026-09-04 (`admin`, Gate 3)

## Context
AssessFlow requires a transaction-heavy workflow with strong consistency guarantees for case data, eligibility decisions, approvals, and audit trails. The system must balance development simplicity with operational concerns for a 25,000 employee pilot.

## Decision
We will use a modular monolith architecture for the MVP, where:
- All components (API, web, worker) are deployed as a single unit but organized as separate modules with clear boundaries
- Single PostgreSQL database serves as the authoritative data store
- Modules communicate through well-defined interfaces (primarily via database and shared contracts)
- Deployment and scaling are handled at the application level rather than service level

## Rationale
✅ **Workflow integrity**: Single database ensures ACID transactions across case lifecycle stages  
✅ **Development simplicity**: No distributed system complexity for initial implementation  
✅ **Operational simplicity**: Single deployment unit, shared runtime environment  
✅ **Performance**: No network latency between components for workflow transitions  
✅ **Future evolution**: Clear module boundaries allow extraction to services if needed later  

## Alternatives Considered
❌ **Microservices**: Increased complexity, eventual consistency challenges, operational overhead  
❌ **Modular monolith with separate deployments**: Adds deployment complexity without clear benefit for MVP scale  
❌ **Serverless functions**: Cold start issues, difficult to manage workflow state, vendor lock-in concerns  

## Implications
### Positive
- Simplified testing and debugging with single process
- Straightforward deployment and rollback procedures
- Easy to implement cross-cutting concerns (logging, security, monitoring)
- Clear ownership of data consistency

### Negative
- Scaling requires scaling entire application rather than specific components
- Potential for module coupling if boundaries not maintained
- Longer build/deploy times as application grows

### Mitigations
- Enforce strict module boundaries through linting and code reviews
- Use feature flags for independent module deployment if needed later
- Plan for eventual service extraction in architecture roadmap
- Implement proper module separation in code structure (separate folders, distinct dependencies)

## Related Decisions
- ADR-002: Host-vs-Standalone boundary decisions
- ADR-003: Environment model (dev/test/prod consistency)
- Gate 4: Data model and migration readiness (single source of truth)
- Gate 5: Workflow and API contract readiness (authoritative server-side logic)

## Notes
This decision assumes the pilot scale (25k employees, 100 concurrent users, 20k cases/year) is achievable with a well-optimized monolith. Performance testing will validate this assumption in Gate 3.