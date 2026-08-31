# AssessFlow Sidebar Specification

## Design objective

The sidebar should make AssessFlow recognizable before the user reads the product name. It intentionally does more than a generic vertical navigation rail while remaining enterprise-friendly.

## Signature elements

1. **Brand header**
   - Compact AssessFlow mark plus product subtitle.
   - Collapse control becomes a small floating edge control in compact mode.

2. **Workspace switcher**
   - Gradient-border card identifies the current assessment workspace/cycle.
   - Includes a live-status dot.
   - This is the primary product-context cue.

3. **Active navigation treatment**
   - Soft indigo/teal gradient background.
   - Thin gradient identity rail on the left.
   - Low-intensity glow; never a heavy neon effect.
   - Icon color becomes primary indigo.

4. **Grouped navigation**
   - `Workspace`, `System`, and `Resources` groups.
   - Uppercase micro labels with generous whitespace.
   - Counts use compact badges and only appear when actionable.

5. **Cycle spotlight**
   - Dark mini-card showing one meaningful live cycle and progress.
   - Avoid turning this into a second dashboard.

6. **Profile / environment footer**
   - User role is visible.
   - Environment status makes demo/staging/production context clear.

## Widths

- Expanded: `286px`
- Collapsed: `92px`
- Mobile: off-canvas drawer

## Interaction

- Collapse state is persisted in localStorage.
- Mobile drawer closes after a navigation choice.
- Active navigation must remain visible without relying only on color.

## Accessibility

- Text labels remain available in expanded mode.
- Interactive controls use native buttons/anchors.
- Active state uses shape, rail and color — not color alone.
- Do not use badges as the only indicator of pending work.
