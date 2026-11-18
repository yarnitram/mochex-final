# Core3C: drawing endpoint handles

## Acceptance

- C3-01: Selecting a visible two point trend line, rectangle or Fibonacci drawing displays its two endpoint handles. Dragging one handle changes only that time/price anchor. Whole-object dragging from the drawing body remains available.
- C3-02: Locked and hidden drawings cannot be resized. Horizontal lines keep whole-object movement and panel editing, without two point handles. Invalid, nonpositive and same-time two point geometry is rejected.
- C3-03: A completed endpoint edit is one Undo/Redo history step, remains unsaved until manual Save, and uses the existing account/symbol/timeframe document and CAS conflict rules. No schema migration or exchange execution.
- C3-04: Add a failing geometry test before implementation. Verify unit tests, typechecks, production build, actual PostgreSQL and browser workflows. Build before the workspace verifier because it starts the built app.

## Limits

Handles render for the selected object only. Editing applies on pointer release; there is no live drag preview, snapping or touch-specific gesture suite. Further drawing tools and multi-chart layouts remain later work.
