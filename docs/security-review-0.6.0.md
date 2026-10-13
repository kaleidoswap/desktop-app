# Desktop 0.6.0 security review — 2026-10-13

The owner requested rebuilding the unannounced 0.6.0 release in place. Prepare and verify signed replacement installers in a separate draft, retain a backup of the current artifacts, and promote only after Linux tests and signature checks pass. Mind assets are unchanged.

## Changes prepared

- Remove the unused Node polyfill plugin and its elliptic dependency (GHSA-848j-6mx2-7j84). The frontend uses browser APIs; the SDK guards its optional process logger.
- Exclude React Native, SVG native peers and the native-only WDK dependency from this web desktop application. These overrides must be revisited if native UI imports are introduced. Upgrade lint-staged to 17.6.0, which requires Node >=22.22.1. Together these remove braces (GHSA-vfj7-8cjw-p6xm), for which no patched version is available.
- Update plist to 1.10.1 and wayland-scanner to 0.31.11, resolving both quick-xml advisories RUSTSEC-2026-0194 and RUSTSEC-2026-0195 across the macOS and Linux dependency trees.
- Update event-listener to 5.4.2 (RUSTSEC-2026-0221).

The complete pnpm audit reports zero known vulnerabilities after these changes. This is not a claim that the entire application has no vulnerabilities.

## Remaining Rust findings

| Package     | Finding           | Assessment and follow-up                                                                                                                                                                                                                                                                                                                                     |
| ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| glib 0.18.5 | RUSTSEC-2024-0429 | Patched locally using the exact two-line upstream fix (gtk-rs-core PR 1343). Cargo selects the vendored 0.18.5 source for GTK/Tauri. Dedicated optimized iterator regression tests cover forward/backward iteration, skipping, Unicode and empty arrays. See vendor/glib/KALEIDOSWAP-PATCH.md for provenance. Version-only scanners may still report 0.18.5. |
| lru 0.16.4  | RUSTSEC-2026-0253 | Used by nostr-database and nostr-relay-pool. Both caches use EventId keys, a Copy wrapper around [u8; 32], with no Drop implementation. The advisory requires a panicking key destructor and caught unwinding; that prerequisite is absent in these caches. Upgrade the Nostr stack separately rather than force an incompatible lru version.                |
| rkyv 0.7.46 | RUSTSEC-2026-0235 | Present through an optional rust_decimal dependency in Cargo.lock. Not selected by cargo tree --target all with the desktop default features. Not demonstrated as compiled into a shipped target; keep the alert visible and revisit if features change.                                                                                                     |

Cargo audit also reports unmaintained dependencies (including the Nostr relay pool, GTK-related utilities and yaml-rust) and yanked versions. These are maintenance findings, separate from demonstrated exploitability. No audit findings have been suppressed or dismissed.

Primary advisories: [glib](https://rustsec.org/advisories/RUSTSEC-2024-0429.html), [lru](https://rustsec.org/advisories/RUSTSEC-2026-0253.html), [rkyv](https://rustsec.org/advisories/RUSTSEC-2026-0235.html).

## Release cleanup

Removed only desktop test releases test-v0.6.0-rc.1, rc.4, rc.5 and rc.6. Git tags were retained. The stable v0.6.0 and every mind-assets release were verified unchanged by asset name and digest after deletion. Mind remains beta. No updater or Mind asset was deleted.

## Validation

- Production frontend build passed (TypeScript and Vite); no missing Node polyfill warnings.
- Frontend suite: 547/549 passed initially; two UI tests hit the default five-second timeout under host load. Both affected files passed on a single-worker rerun with a 30-second timeout (9/9); source timeout settings were not changed.
- pnpm audit: zero known vulnerabilities, including development dependencies.
- cargo audit: XML and event-listener findings removed; rkyv remains in the lockfile audit, plus the glib/lru and maintenance warnings documented above.
- Native Apple Silicon cargo check --locked passed. Linux validation of the GLib backport is required before approval. This review does not validate a new signed installer.
