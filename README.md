# Three Conf — Inside the badge

A self-contained static Three.js assembly story. Serve `dist/` over HTTP; `npm run dev` starts a local preview on port 4173. No CDN or runtime third-party requests are required.

## Assets

- Both enclosure meshes are tessellated from the supplied `speaker_badge_medium_no_switch.step` using build123d.
- The seven finish-cap meshes are connected components from the supplied `small_parts.stl`.
- Branding and fonts come from the supplied badge emulator.
- Electronics are visual recreations based on the measured enclosure layout and linked manufacturer references, available in the page's Parts & references dialog. Cable endpoint mappings follow the supplied assembly guide and the ESP32-S3 header pinout.

## Experience

The opening lays out the complete kit on a tilted metric cutting mat beneath a centered heading, with its screen off. The scroll timeline then shows only components introduced by the current assembly step. The shell closes at step 9, followed by finish caps at step 10. Wiring comes after the ESP32: 24 selectable connections use damped Verlet ropes with pinned solder endpoints, routing springs and length constraints. The final badge supports orbit inspection and runs the unchanged compiled emulator from the supplied project, including its original boot animation, menus and hold-button behavior. Arrow keys navigate; Enter or Space operates the centre button when the canvas is focused.

Rendering uses physical materials, studio environment reflections, shadow maps, GTAO with denoising, output tone mapping and FXAA. Device pixel ratio is capped at 1.5. Reduced-motion preference removes scroll interpolation. The firmware retains its original behavior. Screen-reader accessible guide text remains available if WebGL fails.

## Validation

JavaScript syntax and local module/asset references checked. Opening layout, shell-only step, populated electronics step, closure, final controls and mobile layout visually checked in the browser. No browser errors observed. `npm test` verifies connection count, critical pin mappings, finite geometry and fixed solder endpoints through the closing sequence. The embedded emulator binary was compared byte-for-byte against the supplied original.
