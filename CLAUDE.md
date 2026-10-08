# CLAUDE.md — agent notes for SpacePong

This game is served by the diffenderfer.games hub (the sibling `diffenderfer-games`
repo). The hub's `HANDOFF.md`, `docs/hub.md` and `docs/multiplayer.md` are the canonical
game contract and hub API.

## Races (multiplayer by racing)

The hub (diffenderfer-games) has a **Race** mode that turns a single-player game into
a multiplayer one. Everyone gets the same puzzle from a shared seed plus the creator's
params. The hub draws the waiting card, invites, the 3-2-1, the live HUD and the result
card. It referees the race (the first valid finish wins; game over or giving up loses)
and records it in each player's race history. The game only:

- declares `game.race` in `package.json` (`players`, `params`, `stats`, `minMs`);
- calls `hub.race.define({ start, end, exit })` at boot and builds the puzzle from
  `start(r)`'s `r.seed` + `r.params` only (seeded PRNG, never `Math.random` for the puzzle);
- adds a **Race** button on its main menu: a params picker, then `hub.race.create({ params })`,
  plus `hub.race.browse()` (join) and `hub.race.openHistory()`;
- reports `hub.race.status(stats, progress)` on every change, then `hub.race.finish(stats)`
  or `hub.race.lose(stats)`. Stats are numbers, booleans or `#rrggbb` only, never text.

Canonical docs (read them there, don't copy them here): the hub's `docs/multiplayer.md`
§14 (game guide + definition of done) and `docs/plans/race.md` (design, wire contract,
trust limits, the per-game table). Reference game: the hub's `apps-test/racedemo`. First
real game: The 15 Puzzle (`client/src/routes/Race.tsx`, `tests/hub/race.test.mjs`).

This game loads the hub at runtime (`/_hub/hub.js` / `window.HubSDK.hub`), so `hub.race`
is there once the hub is deployed: no re-sync needed.

Racing isn't planned for this game yet. Adopt it only if a "same puzzle, first to finish"
race fits it.
