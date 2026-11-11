# Nostr LRU security compatibility patches

Registry sources nostr-database 0.44.0 and nostr-relay-pool 0.44.3 retain their
licenses and code unchanged. Only normalized Cargo.toml selects patched
lru >=0.18.2,<0.19 (locked to 0.18.5) instead of 0.16. This removes RUSTSEC-2026-0253 without changing
Nostr's protocol or SDK API. Cargo.toml.orig retains the upstream manifest.
These copies match the daemon security backport; remove when compatible
upstream SDK releases make them unnecessary.
