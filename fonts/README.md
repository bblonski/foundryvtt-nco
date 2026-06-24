# Theme fonts

Each game-line theme (see [styles/themes.css](../styles/themes.css)) declares an
`@font-face` whose `src` points at a `.woff2` file in this folder. The faces use
`font-display: swap` and every theme's font stack ends in a widely-available
system fallback, so **the themes work without these files** — dropping the files
in simply upgrades the typography to the intended faces.

All fonts below are open-license (SIL OFL 1.1 or Apache 2.0) and redistributable
with the system. Download the `.woff2` (e.g. from Google Fonts via
[google-webfonts-helper](https://gwfh.mranftl.com/fonts) or the upstream repo),
rename to the exact filename, and place it here.

| File | Font | Used by | License | Source |
|------|------|---------|---------|--------|
| `Orbitron.woff2`    | Orbitron (700)       | Neon City Overdrive & Star Scoundrels — display | OFL 1.1 | https://fonts.google.com/specimen/Orbitron |
| `ShareTechMono.woff2`| Share Tech Mono (400) | Neon City Overdrive — dice / numerals | OFL 1.1 | https://fonts.google.com/specimen/Share+Tech+Mono |
| `Cinzel.woff2`      | Cinzel (600)         | Dungeon Crawlers — display | OFL 1.1 | https://fonts.google.com/specimen/Cinzel |
| `EBGaramond.woff2`  | EB Garamond (400)    | Dungeon Crawlers — body/numerals | OFL 1.1 | https://fonts.google.com/specimen/EB+Garamond |
| `Anton.woff2`       | Anton (400)          | Hard City — display (matches the sheet's Phosphate title) | OFL 1.1 | https://fonts.google.com/specimen/Anton |
| `SpecialElite.woff2`| Special Elite (400)  | Hard City — typewriter body & numerals (matches TypewriterRevo) | Apache 2.0 | https://fonts.google.com/specimen/Special+Elite |
| `Oswald.woff2`      | Oswald (500)         | Hard City — display fallback | OFL 1.1 | https://fonts.google.com/specimen/Oswald |
| `Limelight.woff2`   | Limelight (400)      | Tomorrow City — Art-Deco display (matches On Air) | OFL 1.1 | https://fonts.google.com/specimen/Limelight |

Until the files are added, every theme — including Neon City Overdrive — falls
back to a system stack (Orbitron → a generic sans for NCO's display; Rajdhani →
Segoe UI for its body; Share Tech Mono → Courier New for its dice numerals).

When adding a file, keep the family name in the `@font-face` block (`NCO Orbitron`,
`NCO Cinzel`, …) so the theme stacks resolve.
