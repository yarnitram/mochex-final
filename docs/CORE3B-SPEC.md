# Core3B: direct drawing interaction

## Scope and acceptance

- B-01: In cursor mode, hit a visible drawing on the primary chart pane and select it. A drag translates both time and price anchors together; the horizontal line keeps one price level. Hidden objects cannot be hit.
- B-02: A locked object may be selected but cannot be dragged. Invalid time or nonpositive price geometry cannot be committed. A completed drag is one history step, so Undo and Redo restore the prior and moved positions.
- B-03: The existing per-account chart document, manual Save, revision conflict handling, unsaved navigation guard and native MEXC perpetual feed remain the persistence boundary. No schema migration.
- B-04: Verify hit/translation behavior with a failing unit test first, then unit, typecheck, production build, real database integration and browser drag/undo/redo plus existing chart and workspace flows.

## Limits

This phase moves whole objects only. It does not add endpoint resize handles, snapping, touch-specific gestures, more tools, multi-chart grids or automatic save. Chart pan and scale remain available in cursor mode except while a selected unlocked drawing is being dragged. Panel geometry editing remains available.
