# Documentation map

## Where the planning material lives

CLAUDE.md asks coding agents to read four planning documents before major work. In this
repository they are kept as follows:

| Required document            | Location                                                           | Notes                          |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| 01 Business and product plan | `Wedding_Venue_Platform_Master_Plan.pdf` (repository root), part 1 | Not yet extracted to Markdown. |
| 02 Technical architecture    | `02_TECHNICAL_ARCHITECTURE.md` (repository root)                   | Read by the implementation.    |
| 03 Delivery and test plan    | `Wedding_Venue_Platform_Master_Plan.pdf`, part 3                   | Not yet extracted to Markdown. |
| 04 Research and validation   | `Wedding_Venue_Platform_Master_Plan.pdf`, part 4                   | Not yet extracted to Markdown. |
| Coding-agent rules           | `CLAUDE.md` (repository root)                                      | Governs this repository.       |

Extracting parts 1, 3 and 4 into `docs/` is a pending task; it is not required to build or run the
slice.

## Documents in this folder

- [api.md](api.md): endpoints, error codes, money and time conventions, examples.
- [adr/README.md](adr/README.md): architecture decisions with status and reconsideration triggers.
- [implementation-status.md](implementation-status.md): what is built, what was run, what is not built.
- [runbooks/](runbooks/): operational procedures (only written when the procedure is exercised).
