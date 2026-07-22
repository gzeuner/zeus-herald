# Multi-Agent Roles & Synchronization Protocol

**Executing runtime:** Grok CLI (and compatible agents)  
**Goal:** Fully autonomous development following best practices.

## Roles

| Role | Responsibility | Independence |
|------|----------------|--------------|
| **Architect** | ADRs, package boundaries, interface contracts, non-functional requirements | High – designs before implementation |
| **Implementer(s)** | Write code according to package specs and ADRs | Medium – may ask Architect for clarification |
| **Reviewer (QA)** | Independent code review, style, security, adherence to contracts | **Full independence** – never the same agent that implemented |
| **Tester** | Unit / integration / e2e tests, dry-run validation, memory & leak checks | Independent of Implementer |
| **Coordinator / Orchestrator** | Sequence packages, resolve conflicts, update roadmap status, keep `.local/` in sync | Single source of progress |

## Synchronization Rules (mandatory)

1. **Single source of truth**  
   - Roadmap & current status live in `.local/ROADMAP-STATUS.md` (never committed).  
   - Completed packages are marked only by the Coordinator after Reviewer + Tester sign-off.

2. **Package = atomic unit of work**  
   - An agent picks **one** open package from `packages/`.  
   - Work is finished only when:  
     - Code compiles / runs  
     - Reviewer has approved  
     - Tester has green results  
     - Coordinator has updated status

3. **Handoff format**  
   Every agent writes a short handoff note into `.local/handoffs/<package-id>-<role>.md` containing:
   - What was done
   - Open questions / risks
   - Files touched
   - How to verify

4. **Conflict resolution**  
   - Architect decides design conflicts.  
   - Coordinator decides sequencing.  
   - Reviewer can block a package; Implementer must address findings.

5. **No silent overwrites**  
   - Agents must `git status` / read current files before editing.  
   - Prefer small, reviewable commits (conventional commits).

6. **Secrets & local state**  
   - Everything under `.local/` and `.env` is private.  
   - Never commit tokens, chat IDs, or machine-specific paths.

## Recommended agent invocation order (per package)

```
Coordinator → Architect (if design needed)
           → Implementer
           → Reviewer
           → Tester
           → Coordinator (status update)
```

Multiple Implementers may work on **different** packages in parallel once the Architect has declared the interfaces stable.
