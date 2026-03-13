

## Fix Note Editor Bullet Point & Stakeholders Layout Issues

### Issues Found

1. **Bullet point moves when typing**: `autoFocus` on the Textarea (line 633) places the cursor at position 0 (before `"• "`), so typing inserts text before the bullet instead of after it.

2. **Notes panel lacks proper scrollbar**: The notes summary panel (line 580-679) has a `max-h-[280px]` on the inner div but the outer wrapper has no scroll constraint, so it still pushes content.

3. **Stakeholders section grows unbounded**: The `StakeholdersSection` component has no max-height. When the Notes panel is open with many notes, it consumes all vertical space, squishing the Updates and Action Items sections to near-zero height.

### Changes (single file: `src/components/DealExpandedPanel.tsx`)

#### Fix 1: Bullet cursor positioning (line 628-634)

Replace `autoFocus` on the Textarea with a `ref` callback that focuses the element AND places the cursor at the end of the text (after `"• "`):

```tsx
<Textarea
  value={noteText}
  onChange={(e) => setNoteText(e.target.value)}
  onKeyDown={handleNoteKeyDown}
  className="min-h-[100px] text-xs resize-none"
  ref={(el) => {
    if (el) {
      el.focus();
      const len = el.value.length;
      el.selectionStart = len;
      el.selectionEnd = len;
    }
  }}
/>
```

#### Fix 2: Constrain Stakeholders section height

Wrap the StakeholdersSection output in a container with `max-h` and `overflow-y-auto` so it scrolls when content is large. Change the outer div (line 462) from:

```tsx
<div className="px-3 pt-1.5 pb-1">
```

to:

```tsx
<div className="px-3 pt-1.5 pb-1 max-h-[45%] overflow-y-auto shrink-0">
```

However, since this is not inside a flex parent that uses percentage heights well, a better approach is to change the parent layout. The parent (line 1182) is:

```tsx
<div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-1">
```

The fix: Make the StakeholdersSection a flex item that can shrink, and give it a max-height so it doesn't dominate. Change line 1184 from:

```tsx
<StakeholdersSection deal={deal} queryClient={queryClient} />
```

to wrap it in a constrained container:

```tsx
<div className="shrink-0 max-h-[40%] overflow-y-auto">
  <StakeholdersSection deal={deal} queryClient={queryClient} />
</div>
```

This ensures:
- Stakeholders section gets at most 40% of the panel height
- When content exceeds that, a scrollbar appears
- Updates and Action Items always get their fair share of space

#### Fix 3: Ensure notes panel scrolls properly

The notes summary panel (line 596) already has `max-h-[280px] overflow-y-auto`, but when inside the constrained container from Fix 2, this works correctly. No additional change needed here -- the outer scroll from Fix 2 handles it.

### Summary

| Change | Line(s) | Description |
|--------|---------|-------------|
| Replace `autoFocus` with ref callback | 628-634 | Cursor placed after bullet on open |
| Wrap StakeholdersSection in scrollable container | 1184 | Max 40% height with scrollbar |

### Technical Notes

- The ref callback fires on every render, but since `el.focus()` is idempotent when already focused, this is harmless
- The `max-h-[40%]` works because the parent has `flex-1 min-h-0` which resolves to an actual pixel height
- Updates and Action Items sections keep their `flex-1 min-h-0` with `h-[220px]`, ensuring they share remaining space equally

