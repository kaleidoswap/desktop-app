# Desktop 0.6.0 security review — 2026-10-13

The rebuilt [stable 0.6.0](https://github.com/kaleidoswap/desktop-app/releases/tag/v0.6.0) was published on 2026-10-13 after replacing the unannounced build at the owner's request. [PR #189](https://github.com/kaleidoswap/desktop-app/pull/189) was squash-merged as `fe42ad85feb01d64217324ac0da4a8cfcb769c4f`; both `v0.6.0` and `latest` point to that source commit. Signed replacement packages passed the checks below. Mind remains beta and its assets were preserved unchanged.

## Shipped changes

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

Desktop test releases `test-v0.6.0-rc.1`, `rc.4`, `rc.5` and `rc.6` were removed earlier; their Git tags were retained. The signed replacement draft was promoted to `v0.6.0` and marked Latest. The temporary backup draft was removed after public-download and updater verification; the previous release artifacts remain in a local backup. Only the stable desktop 0.6.0 release remains. Every protected Mind asset was checked by name and digest and remains unchanged.

## Docker follow-up rebuild

A subsequent 0.6.0 rebuild adds automatic Docker image pulls, a manual availability recheck, and refresh on window focus. Local validation passed: three capability regression tests, TypeScript, ESLint, formatting and `cargo check --locked`. The signed build and public upgrade evidence below applies to the earlier security rebuild at `fe42ad85`, not yet to the Docker follow-up artifacts.

## Validation

Results below apply to the 2026-10-13 release checks, not a continuous security guarantee.

- [PR checks](https://github.com/kaleidoswap/desktop-app/actions/runs/38391371056): frontend formatting, lint, type checks and production build passed; **549/549 frontend tests** passed. Backend tests passed on Linux and macOS Apple Silicon (**21/21 each**).
- **3/3 optimized GLib iterator regression tests** passed. An isolated negative control with the original unpatched implementation reproduced a segmentation fault. The Linux release build compiled the vendored patched GLib source.
- [Signed release build](https://github.com/kaleidoswap/desktop-app/actions/runs/38392877723): all four targets succeeded (macOS Apple Silicon, macOS Intel, Linux x64 and Windows x64).
- All **seven updater-package signatures** were cryptographically verified. Both macOS applications passed code-signature, Gatekeeper notarization and stapled-ticket checks; DMG checksums and matching app/node architectures were verified. Updater signatures do not establish Windows Authenticode signing.
- All **18 public release downloads** matched their expected hashes. The public `latest.json` feed and both release tags were checked.
- The actual updater installed **0.5.1 → 0.6.0** from the public HTTPS feed into a disposable macOS Apple Silicon app copy, verified its signature, and produced the same executable as the validated new ARM build. The upgraded app started successfully; the local application database's logical contents were unchanged. This does not establish update behavior on Windows, Linux or Intel Macs, or migration compatibility for older node wallets.
- `pnpm audit`: **zero known vulnerabilities**, including development dependencies. GitHub Dependabot: **zero open alerts** after the merge.
- `cargo audit`: XML and event-listener findings removed; the version-based GLib finding, lru/rkyv assessments and maintenance warnings remain documented above. No audit findings were suppressed or dismissed.
