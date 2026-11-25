# Credits

Every third-party file shipped with the market visualisation, where it came from and its licence.
Everything else in `assets/web/` (the people, buildings, stalls, goods, vehicles, hills, signs and prints) is
generated in code by this project, and so are the engine notes, horns, police whistles and air brakes. That includes the outer block added later: the gates, walls and
fences, the roadside shops, the wash trough tiles, the ribbed water tank, the cloud layer and every sign, which are
all drawn on canvas or built from simple shapes at load time. No third-party file was added for them, and all sign
text is generic (no real brands, logos or slogans).

## Textures (`assets/web/textures/`)

All from [ambientCG](https://ambientcg.com), released under **CC0 1.0** (public domain). The 1K JPG colour
and normal maps were downloaded, resized to 512 x 512 and recompressed; they are tinted in code.

| File | Source material | Link |
| --- | --- | --- |
| `corrugated_color.jpg`, `corrugated_normal.jpg` | Corrugated Steel 005 | https://ambientcg.com/view?id=CorrugatedSteel005 |
| `ground_color.jpg`, `ground_normal.jpg` | Ground 103 | https://ambientcg.com/view?id=Ground103 |
| `concrete_color.jpg` | Concrete 031 | https://ambientcg.com/view?id=Concrete031 |
| `planks_color.jpg`, `planks_normal.jpg` | Planks 023 A | https://ambientcg.com/view?id=Planks023A |
| `plaster_color.jpg` | Plaster 001 | https://ambientcg.com/view?id=Plaster001 |

## Sounds (`assets/web/sounds/`)

Field recordings from [Freesound](https://freesound.org). The free preview of each was downloaded, cut to a
60 second mono loop with a crossfaded seam, level matched and saved as 48 kbps MP3. Short slices of the loops are
also replayed at people in the crowd as nearby voices.

| File | Recording | Author | Licence | Link |
| --- | --- | --- | --- | --- |
| `market_kigali.mp3` | Marketplace, Gahanga Market, Kigali | KaleidacousticsAudio | CC0 1.0 | https://freesound.org/s/636157/ |
| `market_kampala.mp3` | Market interior, produce, active crowd voices, Kampala, Uganda | kyles | CC0 1.0 | https://freesound.org/s/407167/ |
| `street_lagos.mp3` | Ambient, Sabo Yaba bus stop, Lagos, Nigeria | jehoshaphatia | CC0 1.0 | https://freesound.org/s/411123/ |
| `roadside_hawkers.mp3` | AMBTraf Ambience market hawker traffic near road (Sky Sound Library) | SFXAFRIK | **CC BY 4.0** | https://freesound.org/s/582962/ |
| `market_far.mp3` | African market atmos | mikewest | CC0 1.0 | https://freesound.org/s/407641/ |
| `call_street.mp3` | Nigeria Street Yelling | mkoop028 | CC0 1.0 | https://freesound.org/s/505180/ |

`roadside_hawkers.mp3` is CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/): "AMBTraf Ambience market
hawker traffic near road" by SFXAFRIK, trimmed, looped, level matched and re-encoded.

## Libraries (`assets/web/vendor/`)

From [three.js](https://github.com/mrdoob/three.js) release r160 (npm `three@0.160.0`), **MIT licence**,
copyright the three.js authors. The licence text is in `assets/web/vendor/LICENSE`.

| File | Origin in three.js |
| --- | --- |
| `three.module.js` | `build/three.module.js` |
| `OrbitControls.js` | `examples/jsm/controls/OrbitControls.js` |
| `PointerLockControls.js` | `examples/jsm/controls/PointerLockControls.js` |
| `BufferGeometryUtils.js` | `examples/jsm/utils/BufferGeometryUtils.js` |
| `Sky.js` | `examples/jsm/objects/Sky.js` (sky brightness scaled at runtime, file unchanged) |

## Not shipped

The photos in `reference_photos/` were studied for layout, colours, goods and clothing only. None of them is
copied into the app or loaded by it.
