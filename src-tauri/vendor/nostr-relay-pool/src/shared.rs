// Copyright (c) 2022-2023 Yuki Kishimoto
// Copyright (c) 2023-2025 Rust Nostr Developers
// Distributed under the MIT software license

use std::fmt;
use std::num::NonZeroUsize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use lru::LruCache;
use nostr::prelude::IntoNostrSigner;
use nostr::{Event, EventId, NostrSigner};
use nostr_database::{IntoNostrDatabase, MemoryDatabase, NostrDatabase};
use tokio::sync::{Mutex, RwLock};

use crate::monitor::Monitor;
use crate::policy::AdmitPolicy;
use crate::transport::websocket::{DefaultWebsocketTransport, WebSocketTransport};

// LruCache pre-allocate, so keep this at a reasonable value.
// A good value may be <= 128k, considering that stored values are the 64-bit hashes of the event IDs.
const MAX_VERIFICATION_CACHE_SIZE: usize = 128_000;

#[derive(Debug)]
pub enum SharedStateError {
    SignerNotConfigured,
}

impl std::error::Error for SharedStateError {}

impl fmt::Display for SharedStateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SignerNotConfigured => f.write_str("signer not configured"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct SharedState {
    pub(crate) database: Arc<dyn NostrDatabase>,
    pub(crate) transport: Arc<dyn WebSocketTransport>,
    pub(crate) signer: Arc<RwLock<Option<Arc<dyn NostrSigner>>>>,
    pub(crate) nip42_auto_authentication: Arc<AtomicBool>,
    pub(crate) verification_cache: Arc<Mutex<LruCache<EventId, ()>>>,
    pub(crate) admit_policy: Option<Arc<dyn AdmitPolicy>>,
    pub(crate) monitor: Option<Monitor>,
}

impl Default for SharedState {
    fn default() -> Self {
        Self::new(
            MemoryDatabase::new().into_nostr_database(),
            Arc::new(DefaultWebsocketTransport),
            None,
            None,
            true,
            None,
        )
    }
}

impl SharedState {
    pub fn new(
        database: Arc<dyn NostrDatabase>,
        transport: Arc<dyn WebSocketTransport>,
        signer: Option<Arc<dyn NostrSigner>>,
        admit_policy: Option<Arc<dyn AdmitPolicy>>,
        nip42_auto_authentication: bool,
        monitor: Option<Monitor>,
    ) -> Self {
        let max_verification_cache_size: NonZeroUsize =
            NonZeroUsize::new(MAX_VERIFICATION_CACHE_SIZE)
                .expect("MAX_VERIFICATION_CACHE_SIZE must be greater than 0");

        Self {
            database,
            transport,
            signer: Arc::new(RwLock::new(signer)),
            nip42_auto_authentication: Arc::new(AtomicBool::new(nip42_auto_authentication)),
            verification_cache: Arc::new(Mutex::new(LruCache::new(max_verification_cache_size))),
            admit_policy,
            monitor,
        }
    }

    /// Check if auto authentication to relays is enabled
    #[inline]
    pub fn is_auto_authentication_enabled(&self) -> bool {
        self.nip42_auto_authentication.load(Ordering::SeqCst)
    }

    /// Auto authenticate to relays
    ///
    /// <https://github.com/nostr-protocol/nips/blob/master/42.md>
    pub fn automatic_authentication(&self, enable: bool) {
        self.nip42_auto_authentication
            .store(enable, Ordering::SeqCst);
    }

    /// Get database
    #[inline]
    pub fn database(&self) -> &Arc<dyn NostrDatabase> {
        &self.database
    }

    /// Check if signer is configured
    pub async fn has_signer(&self) -> bool {
        let signer = self.signer.read().await;
        signer.is_some()
    }

    /// Get current nostr signer
    ///
    /// Rise error if it not set.
    pub async fn signer(&self) -> Result<Arc<dyn NostrSigner>, SharedStateError> {
        let signer = self.signer.read().await;
        signer.clone().ok_or(SharedStateError::SignerNotConfigured)
    }

    /// Set nostr signer
    pub async fn set_signer<T>(&self, signer: T)
    where
        T: IntoNostrSigner,
    {
        let mut s = self.signer.write().await;
        *s = Some(signer.into_nostr_signer());
    }

    /// Unset nostr signer
    pub async fn unset_signer(&self) {
        let mut s = self.signer.write().await;
        *s = None;
    }

    /// Check if the event was already verified or verify it.
    ///
    /// This is useful if someone continues to send the same invalid event:
    /// since invalid events aren't stored in the database,
    /// skipping this check would result in the re-verification of the event.
    /// This may also be useful to avoid double verification if the event is received at the exact same time by many different Relay instances.
    ///
    /// This is important since event signature verification is a heavy job!
    pub(crate) async fn verify_and_cache(&self, event: &Event) -> Result<(), nostr::event::Error> {
        let mut cache = self.verification_cache.lock().await;

        // Full IDs avoid treating a hash collision as proof of event verification.
        if cache.contains(&event.id) {
            return Ok(());
        }

        // We now verify the event
        // If the event verification fails, the cache is not populated
        event.verify()?;

        // Event is verified, so we can cache it.
        cache.put(event.id, ());

        Ok(())
    }
}
