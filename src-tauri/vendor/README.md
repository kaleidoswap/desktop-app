# Nostr LRU security compatibility patches

Registry sources nostr-database 0.44.0 and nostr-relay-pool 0.44.3 retain their
licenses and code unchanged. Only normalized Cargo.toml selects patched
lru >=0.18.2,<0.19 (locked to 0.18.5) instead of 0.16. This removes RUSTSEC-2026-0253 without changing
Nostr's protocol or SDK API. Cargo.toml.orig retains the upstream manifest.
These copies match the daemon security backport; remove when compatible
upstream SDK releases make them unnecessary.

## glib 0.18.5: RUSTSEC-2024-0429

Registry glib 0.18.5 is retained with its license and version. The only source change backports upstream gtk-rs/gtk-rs-core commit b5a4071e439bef2b5eea76c3aa25e5ae84839e34 (PR 1343): VariantStrIter passes a mutable out-pointer to the variadic C function. GTK3/Tauri requires glib 0.18, so replacing it with 0.20 would not resolve the existing GTK3 dependency.

Upstream patch: https://github.com/gtk-rs/gtk-rs-core/pull/1343
Advisory: https://rustsec.org/advisories/RUSTSEC-2024-0429.html

This is a source backport, not a claim that upstream glib 0.18.5 is fixed. Version-only scanners may still flag it; no global advisory suppression is added. Linux CI executes the affected iterator operations in release mode, where the original undefined behavior manifests. Remove this vendor override when the GTK stack supports a maintained upstream release.
