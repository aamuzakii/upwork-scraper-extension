# Upwork Spider extension

## Build and load

Run `yarn build`, then load or reload the `dist/` directory as the unpacked Chrome extension.

## Rumah123 hydration timing

Rumah123 uses React hydration. Do not change the page DOM as soon as the content script loads: React can replace that early DOM, which makes injected controls disappear and may trigger React hydration error #418.

`content/rumah123.js` waits for the page `load` event and then waits one more second before it starts its observer or injects any controls. Keep this startup sequence when adding page UI or modifying listing elements.

If a future UI needs to run earlier, test it with a hard reload and confirm that it remains in the Elements panel after Rumah123 finishes rendering.
