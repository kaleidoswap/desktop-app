use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[allow(dead_code)]
pub enum NodeBackendType {
    #[default]
    Native,
    Docker,
}

impl std::fmt::Display for NodeBackendType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NodeBackendType::Native => write!(f, "native"),
            NodeBackendType::Docker => write!(f, "docker"),
        }
    }
}

impl std::str::FromStr for NodeBackendType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "native" => Ok(NodeBackendType::Native),
            "docker" => Ok(NodeBackendType::Docker),
            _ => Err(format!("Unknown backend type: {}", s)),
        }
    }
}
