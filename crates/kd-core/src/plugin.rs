use std::fmt::{Display, Formatter};

pub const CAP_READ_STATE: u32 = 1 << 0;
pub const CAP_PROPOSE_ACTIONS: u32 = 1 << 1;
pub const CAP_RECEIVE_EVENTS: u32 = 1 << 2;
pub const CAP_PATH_QUERY: u32 = 1 << 3;
pub const CAP_DIAGNOSTICS: u32 = 1 << 4;
pub const CAP_DETERMINISTIC_RANDOM: u32 = 1 << 5;
pub const ALL_CAPABILITIES: u32 = CAP_READ_STATE
    | CAP_PROPOSE_ACTIONS
    | CAP_RECEIVE_EVENTS
    | CAP_PATH_QUERY
    | CAP_DIAGNOSTICS
    | CAP_DETERMINISTIC_RANDOM;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PluginManifest {
    pub abi: u16,
    pub capabilities: u32,
    pub max_memory_pages: u16,
    pub systems: Vec<u16>,
}

impl PluginManifest {
    pub fn validate(&self, host_abi: u16) -> Result<(), PluginError> {
        if self.abi != host_abi {
            return Err(PluginError::Abi {
                host: host_abi,
                plugin: self.abi,
            });
        }
        let unknown = self.capabilities & !ALL_CAPABILITIES;
        if unknown != 0 {
            return Err(PluginError::UnknownCapability(unknown));
        }
        if !(1..=1_024).contains(&self.max_memory_pages) {
            return Err(PluginError::MemoryPages(self.max_memory_pages));
        }
        if self.systems.len() > 128 {
            return Err(PluginError::SystemCount(self.systems.len()));
        }
        let mut systems = self.systems.clone();
        systems.sort_unstable();
        if systems.windows(2).any(|pair| pair[0] == pair[1]) {
            return Err(PluginError::DuplicateSystem);
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PluginError {
    Abi { host: u16, plugin: u16 },
    UnknownCapability(u32),
    MemoryPages(u16),
    SystemCount(usize),
    DuplicateSystem,
}

impl Display for PluginError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Abi { host, plugin } => {
                write!(
                    formatter,
                    "plugin ABI {plugin} does not match host ABI {host}"
                )
            }
            Self::UnknownCapability(bits) => {
                write!(formatter, "unknown plugin capability bits {bits:#x}")
            }
            Self::MemoryPages(pages) => {
                write!(formatter, "plugin memory limit {pages} pages is invalid")
            }
            Self::SystemCount(count) => write!(formatter, "plugin declares {count} systems"),
            Self::DuplicateSystem => formatter.write_str("plugin declares a system twice"),
        }
    }
}

impl std::error::Error for PluginError {}

#[cfg(test)]
mod tests {
    use super::{CAP_READ_STATE, PluginError, PluginManifest};

    #[test]
    fn rejects_unknown_capabilities_and_duplicate_systems() {
        let unknown = PluginManifest {
            abi: 1,
            capabilities: 1 << 31,
            max_memory_pages: 10,
            systems: Vec::new(),
        };
        assert!(matches!(
            unknown.validate(1),
            Err(PluginError::UnknownCapability(..))
        ));
        let duplicate = PluginManifest {
            abi: 1,
            capabilities: CAP_READ_STATE,
            max_memory_pages: 10,
            systems: vec![2, 2],
        };
        assert_eq!(duplicate.validate(1), Err(PluginError::DuplicateSystem));
    }
}
