# AssessFlow Component Guidelines

## Buttons

- One primary CTA per logical surface whenever possible.
- Primary uses Indigo/Violet gradient.
- Destructive red is reserved for destructive or irreversible outcomes.
- Minimum control height: 38px for standard desktop actions.

## Forms

- Labels are always visible; placeholders are examples, not labels.
- Focus uses indigo border + subtle focus ring.
- Error messages are written in action-oriented language.
- Disabled fields remain readable but visually muted.

## Status badges

Assessment result mapping:

- Ready Now → Success
- Ready with Development → Warning
- Not Ready → Danger
- Incomplete / Closed → Neutral

Workflow states such as In Progress, Eligibility Review and Pending Approval use Info/Warning/Violet variants. Never remove the status text.

## Tables

- Keep HR identity and ownership visible.
- Use sticky headers in implementation for long lists.
- Sorting/filtering should be server-side when the dataset is large.
- Important result/action columns should not rely on hover.

## Cards / dashboards

- Avoid decoration-only cards.
- Every KPI needs a clear metric label and relevant comparison/context.
- Use donut/bar charts sparingly; status counts are often better as labeled bars or tables.

## Workflow

- The MVP visual workflow is: Request → Eligibility → Plan → Assess → Approve → Complete.
- Result remains a distinct business concept from Recommendation and Approval.
- Numeric score is optional/future, never required to display an assessment result in MVP.

## Responsive behavior

- Desktop first.
- Sidebar becomes off-canvas below 980px.
- Multi-column design-system grids collapse progressively.
- Tables remain horizontally scrollable when needed rather than crushing columns.
