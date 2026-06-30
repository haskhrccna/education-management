# Product

## Register

product

## Users

A Quran-memorization (hifz) program, used across four roles on mobile:

- **Students** — children and adults memorizing the Quran with a teacher. Primary daily users: review what's assigned, record recitations, watch their progress, streaks, badges, and certificates accumulate.
- **Teachers** — run halaqāt (study circles), grade recitations, schedule appointments, write reports, manage recordings, and track each student's memorization and revision.
- **Parents** — follow their child's journey: progress, attendance, grades, certificates; linked to a student account.
- **Admins** — manage users, approvals, teacher-change requests, broadcasts, and program-wide analytics.

Context of use: mostly on phones, often at home or in the mosque/study circle, frequently in short focused sessions around a memorization or review task. The audience spans generations — a young student and an older parent or teacher may use the same screens.

## Product Purpose

A companion for the Quran-memorization journey: it connects a student to their teacher(s) and family, turns invisible daily effort (memorization, revision, attendance) into visible, durable progress, and keeps everyone — student, teacher, parent — aligned on where the student is and what's next. Success looks like a student who stays motivated to return day after day, a teacher who can run their halaqa without administrative friction, and a parent who feels close to a journey that would otherwise be opaque.

## Brand Personality

**Motivating · rewarding · focused.** The voice encourages without pestering and celebrates real milestones (a completed surah, a maintained streak, an earned certificate) with dignity. Warm and human, never corporate. The reward loop is the heart of the experience — but the subject is sacred, so momentum is expressed through genuine achievement and respect, never through cartoon flourish or hollow confetti.

## Anti-references

- **Corporate / sterile SaaS** — cold dashboard-grey enterprise UI with no warmth. This is a personal journey, not a back-office tool.
- **Childish / toy-like** — cartoonish mascots, bouncy elastic motion, sticker-sheet badges. Over-gamification cheapens the reverence of Quran study and alienates adult students, teachers, and parents.
- **Cluttered / institutional** — dense government-portal screens that dump every field at once. Screens must breathe.

## Design Principles

1. **Reward real achievement, with dignity.** Motivation comes from genuine, earned progress — memorization percentage, maintained streaks, completed surahs, certificates — presented with restraint and respect. Celebration is the payoff of the loop, never decoration bolted on. This is how we are "playful" without becoming toy-like.
2. **Reverence under the reward.** The content is sacred. Every celebratory or playful moment must read as respectful. When in doubt, quieter and more dignified wins.
3. **One screen, one job.** Each screen has a single primary task and a single primary action. Earn the user's attention and spend it sparingly — breathing room over density. This is the antidote to the institutional/cluttered failure mode.
4. **Arabic-first, not Arabic-also.** Arabic and RTL are the primary experience; English is the faithful secondary mirror. Layout, iconography, and motion are designed RTL-first, never bolted on.
5. **Inclusive by default, across generations.** A child and an older parent share these screens. Generous type (with the font-size scale), WCAG AA contrast across all themes and dark mode, honored reduced-motion, and status that never depends on color alone are requirements, not enhancements.

## Accessibility & Inclusion

- **Target: WCAG 2.1 AA.** Body text ≥4.5:1, large text ≥3:1, verified across all four themes (green/blue/purple/dark) and dark mode.
- **Large-text / elder-friendly.** Respect the in-app font-size scale (small/medium/large) everywhere; maintain comfortable tap targets (≥44pt) and `hitSlop` on controls. Multi-generational audience includes older parents and teachers.
- **Reduced motion.** Honor the OS reduce-motion preference; celebratory/animated moments degrade to a calm crossfade or instant state.
- **Color-independent status.** Grades, attendance, appointment, and recording statuses must be distinguishable without color (icon, label, or shape), for color-blind users.
- **RTL correctness.** Logical properties and direction-aware icons throughout; Arabic is the primary tested locale.
