# ADR-0002: Money as integer minor units

**Status:** accepted

## Context

Quotes, advances and balances must add up exactly. Binary floating point cannot represent most
decimal amounts exactly, and JavaScript numbers lose precision above 2^53.

## Decision

- Amounts are integer minor units (paisa for PKR) held in `bigint` in the domain and the database
  (`bigint` columns, `*_minor` names).
- Rounding is round-half-up on minor units, applied once per percentage calculation
  (`percentOfHalfUp`). Example: 25% of PKR 725,000 is exactly PKR 181,250.
- On the wire, money is an integer decimal string (`"73500000"`). The browser formats it with
  `formatPkr`. The browser never computes a total that the server did not return.
- Currency is an explicit code. Only PKR is supported today.

## Consequences

- Arithmetic is exact and tested against worked examples (see `packages/domain/test`).
- Tax is not computed. Tax policy needs jurisdiction review (planning report, section 7) and will be
  added as a versioned policy that records rate, base and rounding on each posted line.

## Reconsider when

A second currency is introduced, or a tax policy needs rounding per line rather than per total.
