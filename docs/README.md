# Project Documentation Index

## Reading Order

1.  00_DECISION_SUMMARY.md
2.  01_PRODUCT_BRIEF.md
3.  02_REQUIREMENT_SPECIFICATION.md
4.  03_MVP_SCOPE.md
5.  04_SYSTEM_ARCHITECTURE.md
6.  05_REALTIME_SYNCHRONIZATION_DESIGN.md
7.  06_DATABASE_DESIGN.md
8.  07_WEBSOCKET_EVENT_CONTRACT.md
9.  12_REST_API_CONTRACT.md
10. 09_EPIC_FEATURE_TASK_BREAKDOWN.md
11. 10_5_WEEK_DELIVERY_PLAN.md
12. 11_CODING_AGENT_EXECUTION_PLAN.md

## Source of Truth

- Product/scope decisions: 00, 03
- Architecture: 04
- Realtime behavior: 05
- Database schema: 06
- WebSocket contract: 07
- REST contract: 12
- Task execution order: 09, 10, 11

## For Coding Agents

Before implementing:

- Check 00 for final decisions.
- Check 03 for MVP/should-have boundary.
- Check 07 before WebSocket work.
- Check 12 before REST API work.
- Check 06 before Prisma/database work.
- Do not invent new events, endpoints, or schema fields without updating docs.
