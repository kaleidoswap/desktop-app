# GLib 0.18.5 security backport

Source: crates.io glib 0.18.5, checksum `233daaf6e83ae6a12a52055f568f9d7cf4671dabb78ff9560ab6da230ce00ee5`. See the original registry checksum in the parent change history and .cargo_vcs_info.json for upstream provenance. License: MIT (LICENSE retained).

Only src/variant_iter.rs is modified: the two-line upstream fix from https://github.com/gtk-rs/gtk-rs-core/pull/1343 makes the C out-parameter mutable, fixing RUSTSEC-2024-0429. Cargo.toml and all other upstream source files are unchanged. The package version remains 0.18.5; this is a local backport, not an upstream release.

The desktop [patch.crates-io] selects this source for GTK/Tauri on Linux. CI runs dedicated public-API iterator regression tests with release optimizations, where the original bug can cause a crash. Remove this patch when Tauri no longer requires the affected GLib series. Version-only scanners may still report the advisory; do not substitute a fake version number.
