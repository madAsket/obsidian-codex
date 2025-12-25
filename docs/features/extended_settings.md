# Extended settings (v1)

## Scope
We only expose two advanced toggles for now:
- Internet access → `networkAccessEnabled`
- Web search requests → `webSearchEnabled` (available only when Internet is enabled)

## UX
- Place under Settings → Codex → Advanced.
- Add a warning text near Internet access: “Enables network access for Codex. This may send data to external services.”
- Disable Web search toggle unless Internet access is on.

## Data model
```ts
type ExtendedSettings = {
  internetAccess: boolean;
  webSearch: boolean;
};
```

## Mapping to SDK
- `internetAccess` → `ThreadOptions.networkAccessEnabled`
- `webSearch` → `ThreadOptions.webSearchEnabled` (only true if `internetAccess` is true)

## Notes
- Defaults: both `false`.
- Store in Obsidian settings (same storage as model/reasoning).
