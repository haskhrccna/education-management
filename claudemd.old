🤖 Workflow Orchestration
1. Operation Modes

Plan Mode First: Enter Plan Mode for ANY non-trivial task (3+ steps). Write detailed specs to tasks/todo.md before coding.

Subagent Strategy: Offload research, parallel analysis, or exploration to subagents to keep the main context window clean. One task per subagent.

Self-Improvement Loop: After ANY user correction, update tasks/lessons.md. Write rules to prevent repeat mistakes.

Autonomous Bug Fixing: Fix bugs immediately using logs and failing tests. Do not ask for hand-holding or context switching.

2. Execution Standards

Demand Elegance: For non-trivial changes, pause and ask: "Is there a more elegant way?" Avoid hacky fixes; aim for Staff Engineer quality.

Verification: Never mark a task complete without proof (tests, logs, or diffs).

Simplicity First: Make every change as simple as possible. Find root causes rather than applying temporary patches.

🏗️ Project Structure & Tech Stack
Stack: Express + TS • PostgreSQL (Prisma 6) • Redis (BullMQ) • JWT • Zustand • i18next (Arabic RTL)

Plaintext
packages/
├── server/src/     → Express API (controllers, services, routes, middleware)
├── server/prisma/  → Schema + seed
└── shared/src/     → Shared TS types, enums, Zod validators
mobile/src/         → Expo RN app (api, auth, hooks, settings, i18n)
🛠️ Development Guidelines
1. Adding Code

API Flow: route in server/src/routes/ → controller in server/src/controllers/ → service logic in server/src/services/.

Validation: Use Zod validators from @edu/shared on all POST/PUT body params.

Error Handling: Return via centralized AppError — do not throw raw errors.

Shared Types: Add to packages/shared/src/types/ and re-export from index.ts.

Mobile API: Use the typed Axios client in mobile/src/api/ with existing hook patterns (e.g., useAppointments).

2. Style & Conventions

Naming: kebab-case files, camelCase functions, PascalCase components/models.

Commits: Conventional Commits (e.g., feat(scope): ..., fix(scope): ...).

Versioning: All API routes versioned under /api/v1/*.

Database: Use Prisma schema only. Never write raw SQL without a formal migration.

🚀 Commands Reference
Action	Command
Start Server	cd packages/server && npm run dev (Port: 4000)
Run Tests	npm run test:server
Start Mobile	cd mobile && npm start
DB Migration	npx prisma migrate dev
DB Seed	npx prisma db seed
📝 Task Management Protocol
Plan First: Write plan to tasks/todo.md with checkable items.

Verify Plan: Check in with the user before starting implementation.

Track Progress: Mark items complete as you go.

Explain Changes: Provide a high-level summary at each major step.

Document Results: Add a "Review" section to tasks/todo.md.

Capture Lessons: Update tasks/lessons.md immediately after any corrections.