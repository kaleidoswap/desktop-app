//! What the signer answered, for the Live screen: each swap it signed, with the terms it worked
//! out from the PSBT, and each it refused, with the full reason (the maker only hears the
//! category). Fed from `SignerHandle::answers()` and kept on disk across restarts.

use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use signer_core::Answer;

use super::store::JsonFile;

const KEEP: usize = 200;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Signed,
    Refused,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Side {
    /// The client gave the asset and received BTC.
    Sell,
    /// The client gave BTC and received the asset.
    Buy,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Entry {
    pub swap_id: String,
    /// Unix seconds of the answer.
    pub at: u64,
    pub status: Status,
    /// What the client gave and got, from the PSBT: for a signed swap only.
    pub side: Option<Side>,
    pub asset_id: Option<String>,
    /// Asset base units and sats.
    pub units: u64,
    pub sat: u64,
    /// Why it was refused.
    pub reason: Option<String>,
}

impl Entry {
    pub fn of(answer: &Answer, at: u64) -> Self {
        match answer {
            Answer::Signed { swap_id, terms } => Self {
                swap_id: swap_id.clone(),
                at,
                status: Status::Signed,
                side: Some(if terms.sells { Side::Sell } else { Side::Buy }),
                asset_id: Some(terms.asset_id.clone()),
                units: terms.asset_amount,
                sat: terms.btc_amount,
                reason: None,
            },
            Answer::Refused { swap_id, reason } => Self {
                swap_id: swap_id.clone(),
                at,
                status: Status::Refused,
                side: None,
                asset_id: None,
                units: 0,
                sat: 0,
                reason: Some(reason.clone()),
            },
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct JournalData {
    /// Newest first.
    pub entries: VecDeque<Entry>,
}

#[derive(Clone)]
pub struct Journal(Arc<Mutex<JsonFile<JournalData>>>);

impl Journal {
    pub fn open(path: PathBuf) -> Self {
        Self(Arc::new(Mutex::new(JsonFile::load(path))))
    }

    pub fn snapshot(&self) -> JournalData {
        self.0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .value
            .clone()
    }

    pub fn record(&self, answer: &Answer, at: u64) {
        let mut file = self
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        file.value.entries.push_front(Entry::of(answer, at));
        file.value.entries.truncate(KEEP);
        file.save();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use signer_core::Terms;

    #[test]
    fn answers_are_kept_newest_first_with_the_terms_or_the_reason_and_survive_a_restart() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("journal.json");
        let j = Journal::open(path.clone());
        let terms = Terms {
            swap_id: "a".into(),
            asset_id: "rgb:x".into(),
            sells: true,
            asset_amount: 7,
            btc_amount: 7_000,
            expires_at: None,
        };
        j.record(
            &Answer::Signed {
                swap_id: "a".into(),
                terms,
            },
            10,
        );
        j.record(
            &Answer::Refused {
                swap_id: "b".into(),
                reason: "policy: buying this asset is not allowed".into(),
            },
            11,
        );

        let again = Journal::open(path).snapshot();
        assert_eq!(again.entries.len(), 2);
        let (refused, signed) = (&again.entries[0], &again.entries[1]);
        assert_eq!(
            (refused.status, refused.reason.as_deref()),
            (
                Status::Refused,
                Some("policy: buying this asset is not allowed")
            )
        );
        assert_eq!(
            (signed.status, signed.side, signed.units, signed.sat),
            (Status::Signed, Some(Side::Sell), 7, 7_000)
        );
    }
}
