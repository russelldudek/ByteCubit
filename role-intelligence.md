# Role Intelligence - Industrial Automation Engineer (Ignition Development)

## Nominal role
Contract industrial automation engineer developing and configuring Ignition, modernizing legacy MES functionality, supporting SQL/manufacturing applications, cleaning AVEVA PI, and connecting plant data to a cloud data lake.

## Actual mandate
Create a dependable modernization bridge from legacy manufacturing applications to a supportable Ignition/data architecture while production continues to run.

## Company moment
Bytecubit publicly positions itself as an IT solutions and staff-augmentation provider with implementation, custom software, data warehouse/BI, analytics, infrastructure, cloud, and AI/ML services. The role appears to place a specialist into an undisclosed manufacturing client environment; client identity and internal architecture are not public and are not inferred.

## Operating tensions
1. Delivery speed vs production continuity.
2. Enterprise standardization vs legitimate plant-specific needs.
3. Historian cleanup vs unknown downstream consumers.
4. Cloud access vs OT reliability, security, and ownership.
5. Specialist platform throughput vs broader system modernization discipline.

## Stakeholders
Manufacturing operations; controls/automation; application development; database/data engineering; quality; maintenance; R&D; cybersecurity/network/infrastructure; historian/data platform owners; cloud data-lake consumers; Bytecubit account/delivery leadership; undisclosed client sponsor.

## Decision architecture
- Which functions are worth reproducing, redesigning, or retiring?
- What should become an Ignition standard versus a local exception?
- When is parity sufficient for cutover?
- Which PI points/context can change without harming consumers?
- What data belongs in the cloud and who owns its meaning?
- What holds, rolls back, escalates, or stops?

## Success measures
Validated releases; production disruption avoided; function/data parity; recurring issue categories; diagnosis time; reusable component adoption; historian completeness/context; cloud data freshness/consumer acceptance; support ownership; learning velocity.

## Change burden
Operators, engineers, support teams, data consumers, and owners must shift from implicit local knowledge to explicit tags, data contracts, tests, release criteria, diagnostics, ownership, and learning records.

## Candidate evidence boundary
Russell has verified manufacturing, high-reliability engineering, SQL/data workflow, software-enabled robotics, quality, operations, and modernization evidence. The record does not verify years of production Ignition configuration or AVEVA PI administration. Candidate-facing materials present an affirmative adjacent-fit case and propose bounded technical proof.

## White-space thesis
**Don't migrate screens. Prove the signal path.** Use a Signal Twin Workbench to compare legacy and Ignition paths, reconcile SQL/PI context, and release only when function, data, ownership, and rollback evidence are explicit.
