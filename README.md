# Three Conf — Inside the badge

Live: **https://hervestudio.github.io/badge-factory/**

A self-contained static Three.js assembly story. Serve `dist/` over HTTP; `npm run dev` starts a local preview on port 4173. No CDN or runtime third-party requests are required.

## Embedding the 3D badge

`dist/embed.html` is the assembled badge on its own — the same scene, materials and firmware the
assembly page ends on, with no story around it. It fills whatever iframe it is given and sits on a lilac
`#d6d5f9` backdrop, which `?bg=` overrides.

```html
<iframe src="https://hervestudio.github.io/badge-factory/embed.html"
        title="Three.js Conf badge in 3D" loading="lazy"
        style="border:0;width:100%;height:520px;display:block"></iframe>
```

| Parameter | Default | What it does |
| --- | --- | --- |
| `bg` | `#d6d5f9` | Page background, e.g. `?bg=%23f5f4f0` or `?bg=transparent` to let the host show through |
| `spin` | on | Slow auto-rotation; pauses while the visitor drags, resumes 2.6 s later. `?spin=0` to stop it |
| `spinspeed` | `0.55` | Auto-rotation speed |
| `margin` | `1.232` | Framing; higher leaves more room around the badge |
| `zoom` | off | `?zoom=1` lets the wheel and pinch zoom. Off by default so the embed never swallows page scroll |
| `drag` | one finger | `?drag=two` leaves one-finger swipes to the host page and turns the badge on two fingers |
| `hint` | on | The animated "drag to turn · tap the buttons" pill, which leaves on the first gesture. `?hint=0` removes it |
| `name`, `role` | BRUNO SIMON, THREE.JS JOURNEY | The name plate |

Clicking a button cap presses the real button; arrow keys and space work once the canvas has focus.
Nothing renders while the iframe is off-screen or the tab is hidden.

## The afterparty block

`dist/embed-party.html` is the second embed: the event photos laid out as in the Figma frame, with
the badge's disco ball drawn live over them — the animation from the disco-ball tool, dropping in on
its string and swinging itself still. Everything fades in and the ball drops the first time the
block is actually scrolled into view, and nothing renders while it is off-screen.

```html
<iframe src="https://hervestudio.github.io/badge-factory/embed-party.html"
        title="Three.js Conf afterparty" loading="lazy"
        style="border:0;width:100%;aspect-ratio:1028/990;display:block"></iframe>
```

The composition keeps the frame's 1028 × 990 proportions and centres itself, so giving the iframe
that aspect ratio avoids letterboxing. `?spin=` changes the ball's rotation speed (default `0.6`).

## Publishing

GitHub Pages serves the `gh-pages` branch, which holds the contents of `dist/`. To ship a new build:

```sh
git push origin main
git subtree push --prefix dist origin gh-pages
```

## Assets

- Both enclosure meshes are tessellated from the supplied `speaker_badge_medium_no_switch.step` using build123d.
- The seven finish-cap meshes are connected components from the supplied `small_parts.stl`.
- Branding and fonts come from the supplied badge emulator.
- Electronics are visual recreations based on the measured enclosure layout and linked manufacturer references, available in the page's Parts & references dialog. Cable endpoint mappings follow the supplied assembly guide and the ESP32-S3 header pinout.

## Experience

The opening lays out the complete kit on a wide, rounded metric cutting mat beneath a centered heading, with its screen off. The scroll timeline then shows only components introduced by the current assembly step. The shell closes at step 9, followed by finish caps at step 10. Wiring comes after the ESP32: 24 selectable connections plus the trimmed, unconnected white ribbon conductor use damped Verlet ropes with pinned solder endpoints, routing springs and length constraints. The screen wires travel together as a ribbon and finish drawing by progress 7.36. Part hover/tap cards link to the supplied purchase references. The rear shell is yellow and the lanyard is recreated as a woven violet loop with hardware. The final badge supports orbit inspection and runs the unchanged compiled emulator from the supplied project, including its original boot animation, menus and hold-button behavior. Arrow keys navigate; Enter or Space operates the centre button when the canvas is focused.

Rendering uses physical materials, studio environment reflections, shadow maps, GTAO with denoising, output tone mapping and FXAA. Device pixel ratio is capped at 1.5. Reduced-motion preference removes scroll interpolation. The firmware retains its original behavior. Screen-reader accessible guide text remains available if WebGL fails.

## Validation

JavaScript syntax and local module/asset references checked. Opening layout, shell-only step, populated electronics step, closure, final controls and mobile layout visually checked in the browser. No browser errors observed. `npm test` verifies connection count, critical pin mappings, finite geometry and fixed solder endpoints through the closing sequence. The embedded emulator binary was compared byte-for-byte against the supplied original.

## Render tuning

The **Render settings** button opens vendored dat.GUI 0.7.9. Image, lighting, shadow/AO and material parameters update the scene live. **Copy settings** writes a versioned JSON to the clipboard and also opens a selectable text fallback. **Import** validates/clamps values before applying them; **Reset** restores the shipped defaults. Settings persist in localStorage for the current browser/origin. No settings are transmitted. `npm test` includes export/import schema round-trip and validation checks.

`guide.html` is a complete English edition of the user-supplied assembly guide, retaining its pin tables, preparation, ordered steps, closing checks, OTA instructions and later workshop corrections.
