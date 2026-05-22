# Mux Roadmap

**Goal:** A desktop app that lets you give natural-language tasks to AI agents that implement features across multiple projects, each running in an isolated Docker container sandbox.

---

## Recently Completed

- [x] Docker container stopped on workspace archive (instead of running headlessly)
- [x] Login UI: token form hidden while GitHub device-flow is active; GitHub promoted as primary login method
- [x] HTTPS credential prompting during git clone/pull
- [x] Project pull UI

---

## Docker Sandbox

- [ ] **Docker image selection UI** — allow choosing the image per workspace/project from the UI (currently only editable in `mux.config.json`)
- [ ] **Container initialization feedback** — show progress during slow image pulls so the UI doesn't feel frozen
- [ ] **Container status panel** — show running/stopped state, resource usage (CPU/RAM) per workspace
- [ ] **Sandbox policy controls** — UI to configure network access, bind mounts, CPU/memory limits per container
- [ ] **Docker image build support** — trigger `docker build` from within the app (Dockerfile authoring or build-on-create option)

---

## Task Dispatch & Automation

- [ ] **Task queue / batch dispatch** — queue N tasks across M projects and run them sequentially or in parallel without manual per-workspace interaction
- [ ] **Cross-project task templates** — define a reusable task (prompt + settings) and run it against multiple projects at once
- [ ] **Task scheduling** — run tasks on a schedule or trigger them from external events

---

## Result Review & Handoff

- [ ] **Diff / PR creation flow** — one-click "open PR from workspace changes" after the agent finishes, including branch push and PR description generation
- [ ] **Inline diff review** — dedicated side-by-side diff viewer inside the app so the user can review agent changes without switching to a terminal or external tool
- [ ] **Agent output artifact export** — download a patch file or zip of all changes from a workspace

---

## Project & Workspace Management

- [ ] **Project import / clone UI** — fully polished flow for cloning a remote repo into a new managed workspace (partially done)
- [ ] **Workspace templates** — pre-configured workspace setups (runtime, model, agent, tools) that can be applied when creating a new workspace

---

## UX & Polish

- [ ] **Onboarding flow** — guided setup for first-time users: add a project, pick a runtime, send first task
- [ ] **Mobile / responsive layout** — basic usability on smaller screens for monitoring running tasks

