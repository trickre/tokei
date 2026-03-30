# AGENT.md

## Project

- App type: Web application
- Stack: Vite + TypeScript + plain CSS
- Main features: digital clock display and countdown timer

## Goals

- Keep the app lightweight and easy to read.
- Prefer browser-native APIs over extra libraries.
- Preserve a fast local development workflow.

## Directory Expectations

- `src/main.ts`: application bootstrap and UI logic
- `src/style.css`: all styles using plain CSS
- `index.html`: single app entry

## Working Rules

- Understand the requested behavior before editing.
- Prefer small, reversible changes.
- Avoid introducing frameworks or UI libraries.
- Keep dependencies minimal unless they are clearly necessary.
- Follow the existing structure and naming when extending the app.

## Implementation Guidance

- Use TypeScript with strict, simple DOM code.
- Use `setInterval` or equivalent browser timing APIs for clock and timer updates.
- Keep timer state explicit: idle, running, paused, finished.
- Make responsive layout changes in plain CSS without preprocessors.

## Commands

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Build for production: `npm run build`
- Preview build: `npm run preview`

## Verification

- Run `npm run build` after meaningful changes.
- If behavior changes are significant, verify both clock display and timer controls in the browser.
- If verification cannot be completed, state what remains unchecked.

## Editing Constraints

- Do not overwrite unrelated user changes.
- Do not remove files unless the task requires it.
- Prefer ASCII unless an existing file already uses non-ASCII text.
- Keep comments brief and only where they clarify non-obvious logic.

## Communication

- Be concise.
- State assumptions when they matter.
- Report blockers immediately.
