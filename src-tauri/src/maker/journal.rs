//! What the signer was asked and what it answered, for the Live screen.
//!
//! Two sources fill it. The policy records its own decision on every request it sees. A watcher
//! reads the signer's conversation with the maker on the relays (both directions are NIP-44
//! between the same two keys, so the signer can read its own answers): the requests, the final
//! `signed` / `refused` with the reason, and the maker's pings.

use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use nostr_sdk::nips::nip44;
use nostr_sdk::prelude::*;
use serde::{Deserialize, Serialize};
use signer_core::protocol::{Envelope, KIND, VERSION};
use signer_core::{SignerMsg, Terms};

use super::policy::{Side, Swap};
use super::store::JsonFile;

const KEEP: usize = 200;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    /// The maker asked; no decision seen yet.
    Requested,
    /// The policy let it through; the signature follows.
    Approved,
    Signed,
    Refused,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Entry {
    /// The request id the maker chose.
    pub id: String,
    pub swap_id: String,
    /// Unix seconds of the first thing seen about it.
    pub at: u64,
    pub side: Option<Side>,
    pub asset_id: Option<String>,
    /// Asset base units and sats, from the client's side.
    pub units: u64,
    pub sat: u64,
    pub status: Status,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct JournalData {
    pub entries: VecDeque<Entry>,
    /// When the maker last pinged this signer (unix seconds).
    pub last_ping: Option<u64>,
}

#[derive(Clone)]
pub struct Journal(Arc<Mutex<JsonFile<JournalData>>>);

impl Journal {
    pub fn open(path: PathBuf) -> Self {
        Self(Arc::new(Mutex::new(JsonFile::load(path))))
    }

    fn with<R>(&self, f: impl FnOnce(&mut JournalData) -> R) -> R {
        let mut file = self
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let out = f(&mut file.value);
        file.save();
        out
    }

    pub fn snapshot(&self) -> JournalData {
        self.0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .value
            .clone()
    }

    /// Update the entry for request `id`, adding it when it is new. A final status (`signed`,
    /// `refused`) is never moved back by a message that arrives late.
    fn upsert(
        &self,
        id: &str,
        swap_id: &str,
        at: u64,
        swap: Option<&Swap>,
        status: Status,
        reason: Option<&str>,
    ) {
        self.with(|j| {
            let entry = match j.entries.iter_mut().find(|e| e.id == id) {
                Some(e) => e,
                None => {
                    j.entries.push_front(Entry {
                        id: id.to_string(),
                        swap_id: swap_id.to_string(),
                        at,
                        side: None,
                        asset_id: None,
                        units: 0,
                        sat: 0,
                        status: Status::Requested,
                        reason: None,
                    });
                    j.entries.truncate(KEEP);
                    &mut j.entries[0]
                }
            };
            if let Some(s) = swap {
                entry.side = Some(s.side);
                entry.asset_id = Some(s.asset_id.clone());
                entry.units = s.units;
                entry.sat = s.sat;
            }
            if status > entry.status || (status == Status::Refused && entry.reason.is_none()) {
                entry.status = status;
                if let Some(r) = reason {
                    entry.reason = Some(r.to_string());
                }
            }
        });
    }

    /// The policy's decision on request `id`: `refused` carries the policy's reason.
    pub fn decided(
        &self,
        id: &str,
        swap_id: &str,
        swap: Option<&Swap>,
        refused: Option<&str>,
        now: u64,
    ) {
        match refused {
            None => self.upsert(id, swap_id, now, swap, Status::Approved, None),
            Some(r) => self.upsert(
                id,
                swap_id,
                now,
                swap,
                Status::Refused,
                Some(&format!("policy: {r}")),
            ),
        }
    }

    /// One message of the signer's conversation with the maker.
    pub fn seen(&self, msg: &SignerMsg, at: u64) {
        match msg {
            SignerMsg::SignRequest { request } => {
                let swap = Swap::of(&Terms::of(&request.offer)).ok();
                self.upsert(
                    &request.id,
                    request.swap_id(),
                    at,
                    swap.as_ref(),
                    Status::Requested,
                    None,
                )
            }
            SignerMsg::Signed { id, swap_id, .. } => {
                self.upsert(id, swap_id, at, None, Status::Signed, None)
            }
            SignerMsg::Refused {
                id,
                swap_id,
                reason,
            } => self.upsert(id, swap_id, at, None, Status::Refused, Some(reason)),
            SignerMsg::Ping { .. } => self.with(|j| j.last_ping = Some(at)),
            SignerMsg::Pong { .. } => {}
        }
    }
}

/// The message in `event` if it is part of the conversation between `keys` (the signer) and
/// `maker`, in either direction.
pub fn read(keys: &Keys, maker: &PublicKey, event: &Event) -> Option<SignerMsg> {
    if event.kind != Kind::Custom(KIND) {
        return None;
    }
    let me = keys.public_key();
    let to = |pk: &PublicKey| event.tags.public_keys().any(|p| p == pk);
    let ours = (event.pubkey == *maker && to(&me)) || (event.pubkey == me && to(maker));
    if !ours || event.verify().is_err() {
        return None;
    }
    // NIP-44 uses one conversation key per pair of keys, whoever wrote
    let json = nip44::decrypt(keys.secret_key(), maker, &event.content).ok()?;
    let env: Envelope = serde_json::from_str(&json).ok()?;
    (env.v == VERSION).then_some(env.msg)
}

/// The filter for both directions of the conversation, from `since` on.
pub fn filter(me: PublicKey, maker: PublicKey, since: u64) -> Vec<Filter> {
    let base = Filter::new()
        .kind(Kind::Custom(KIND))
        .since(Timestamp::from_secs(since));
    vec![
        base.clone().author(maker).pubkey(me),
        base.author(me).pubkey(maker),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use signer_core::protocol::seal;

    fn journal() -> (tempfile::TempDir, Journal) {
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path().join("journal.json"));
        (dir, j)
    }

    #[test]
    fn the_signer_reads_both_sides_of_its_conversation_and_nothing_else() {
        let signer = Keys::generate();
        let maker = Keys::generate();
        let stranger = Keys::generate();
        let ping = SignerMsg::Ping { id: "p".into() };
        let refused = SignerMsg::Refused {
            id: "r".into(),
            swap_id: "s".into(),
            reason: "policy: no".into(),
        };

        let incoming = seal(&maker, &signer.public_key(), &ping)
            .unwrap()
            .sign_with_keys(&maker)
            .unwrap();
        assert_eq!(
            read(&signer, &maker.public_key(), &incoming),
            Some(ping.clone())
        );
        // our own answer, sealed for the maker
        let outgoing = seal(&signer, &maker.public_key(), &refused)
            .unwrap()
            .sign_with_keys(&signer)
            .unwrap();
        assert_eq!(read(&signer, &maker.public_key(), &outgoing), Some(refused));
        // someone else writing to us is not the maker
        let other = seal(&stranger, &signer.public_key(), &ping)
            .unwrap()
            .sign_with_keys(&stranger)
            .unwrap();
        assert_eq!(read(&signer, &maker.public_key(), &other), None);
    }

    #[test]
    fn a_final_answer_is_not_undone_by_a_message_that_arrives_late() {
        let (_d, j) = journal();
        j.seen(
            &SignerMsg::Signed {
                id: "a".into(),
                swap_id: "s1".into(),
                psbt: String::new(),
            },
            10,
        );
        j.decided("a", "s1", None, None, 9);
        let e = j.snapshot().entries[0].clone();
        assert_eq!((e.status, e.swap_id.as_str()), (Status::Signed, "s1"));

        // the policy's own reason is kept when the answer only says "policy: …" again
        j.decided("b", "s2", None, Some("selling TUSD is not allowed"), 11);
        j.seen(
            &SignerMsg::Refused {
                id: "b".into(),
                swap_id: "s2".into(),
                reason: "policy: selling TUSD is not allowed".into(),
            },
            12,
        );
        let e = j.snapshot().entries[0].clone();
        assert_eq!(e.status, Status::Refused);
        assert_eq!(
            e.reason.as_deref(),
            Some("policy: selling TUSD is not allowed")
        );
    }

    #[test]
    fn pings_are_remembered_and_the_journal_survives_a_restart() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("journal.json");
        let j = Journal::open(path.clone());
        j.seen(&SignerMsg::Ping { id: "x".into() }, 42);
        j.seen(
            &SignerMsg::Refused {
                id: "c".into(),
                swap_id: "s".into(),
                reason: "the request expired before it reached the signer".into(),
            },
            43,
        );
        let again = Journal::open(path).snapshot();
        assert_eq!(again.last_ping, Some(42));
        assert_eq!(again.entries.len(), 1);
        assert_eq!(again.entries[0].status, Status::Refused);
    }
}
