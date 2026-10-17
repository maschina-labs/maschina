/**
 * A made-up Rust module, used only as texture behind the "Read every line" section. It reads like the kind of check a
 * machine's limits make, but it is not a file from this repository and says nothing about one: the section blurs it past
 * reading and hides it from assistive technology. It is split into colored pieces here so the section can draw it like an
 * editor does, without a highlighting library.
 */
const SOURCE = `//! Checks an action against a machine's limits before anything is signed.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

/// What a machine is allowed to do, set by its owner.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Limits {
    pub max_spend: u64,
    pub max_per_trade: u64,
    pub allowed: Vec<Pubkey>,
    pub window: Duration,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Refusal {
    OverBudget { asked: u64, left: u64 },
    UnknownToken(Pubkey),
    TooSoon(Duration),
    Halted,
}

pub struct Action {
    pub token: Pubkey,
    pub amount: u64,
    pub at: Instant,
}

impl Limits {
    pub fn new(max_spend: u64, window: Duration) -> Self {
        Self {
            max_spend,
            max_per_trade: max_spend / 4,
            allowed: Vec::new(),
            window,
        }
    }

    /// Every rule is checked, in order. The first one that fails is the reason.
    pub fn check(&self, action: &Action, spent: u64) -> Result<(), Refusal> {
        if action.amount > self.max_per_trade {
            return Err(Refusal::OverBudget {
                asked: action.amount,
                left: self.max_per_trade,
            });
        }
        let left = self.max_spend.saturating_sub(spent);
        if action.amount > left {
            return Err(Refusal::OverBudget { asked: action.amount, left });
        }
        if !self.allowed.contains(&action.token) {
            return Err(Refusal::UnknownToken(action.token));
        }
        Ok(())
    }
}

pub struct Record {
    entries: RwLock<Vec<Entry>>,
}

#[derive(Clone)]
pub struct Entry {
    pub at: Instant,
    pub amount: u64,
    pub outcome: Outcome,
}

#[derive(Clone)]
pub enum Outcome {
    Allowed,
    Refused(String),
}

impl Record {
    pub fn new() -> Self {
        Self { entries: RwLock::new(Vec::new()) }
    }

    pub async fn spent_in(&self, window: Duration) -> u64 {
        let entries = self.entries.read().await;
        entries
            .iter()
            .filter(|entry| entry.at.elapsed() < window)
            .filter(|entry| matches!(entry.outcome, Outcome::Allowed))
            .map(|entry| entry.amount)
            .sum()
    }

    pub async fn append(&self, entry: Entry) {
        let mut entries = self.entries.write().await;
        entries.push(entry);
        tracing::info!("recorded entry {}", entries.len());
    }
}

pub async fn decide(
    limits: &Limits,
    record: &Record,
    action: Action,
) -> Result<Action, Refusal> {
    let spent = record.spent_in(limits.window).await;
    match limits.check(&action, spent) {
        Ok(()) => {
            record
                .append(Entry { at: action.at, amount: action.amount, outcome: Outcome::Allowed })
                .await;
            Ok(action)
        }
        Err(reason) => {
            let note = format!("{reason:?}");
            record
                .append(Entry { at: action.at, amount: action.amount, outcome: Outcome::Refused(note) })
                .await;
            Err(reason)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn limits() -> Limits {
        let mut limits = Limits::new(1_000, Duration::from_secs(86_400));
        limits.allowed.push(Pubkey::new_unique());
        limits
    }

    #[test]
    fn refuses_what_is_over_the_budget() {
        let limits = limits();
        let action = Action { token: limits.allowed[0], amount: 900, at: Instant::now() };
        assert!(matches!(limits.check(&action, 0), Err(Refusal::OverBudget { .. })));
    }

    #[test]
    fn allows_a_small_trade_in_an_allowed_token() {
        let limits = limits();
        let action = Action { token: limits.allowed[0], amount: 50, at: Instant::now() };
        assert_eq!(limits.check(&action, 0), Ok(()));
    }
}
`;

export type Kind =
	| "comment"
	| "keyword"
	| "type"
	| "string"
	| "macro"
	| "number"
	| "attribute"
	| "plain";

const RULES: [RegExp, Kind][] = [
	[/^\/\/.*/, "comment"],
	[/^"(?:[^"\\]|\\.)*"/, "string"],
	[/^#!?\[[^\]]*\]/, "attribute"],
	[
		/^(?:pub|fn|let|mut|impl|struct|enum|match|if|else|use|mod|async|await|self|Self|return|const|trait|for|in|where|type|as|crate|move|dyn|loop|while)\b/,
		"keyword",
	],
	[/^[A-Za-z_]\w*!/, "macro"],
	[/^[A-Z][A-Za-z0-9_]*\b/, "type"],
	[/^\d[\d_]*(?:u8|u32|u64|usize)?\b/, "number"],
	[/^(?:[A-Za-z_]\w*|\s+|.)/, "plain"],
];

/** One line of the module, cut into pieces that each have a kind. */
function tokenize(line: string): { text: string; kind: Kind }[] {
	const pieces: { text: string; kind: Kind }[] = [];
	let rest = line;
	while (rest.length > 0) {
		for (const [pattern, kind] of RULES) {
			const found = pattern.exec(rest);
			if (!found) continue;
			const text = found[0];
			const last = pieces.at(-1);
			if (kind === "plain" && last?.kind === "plain") last.text += text;
			else pieces.push({ text, kind });
			rest = rest.slice(text.length);
			break;
		}
	}
	return pieces;
}

export const RUST_LINES = SOURCE.trimEnd()
	.split("\n")
	.map((line) => tokenize(line));
