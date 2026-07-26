//! Deterministic, browser-independent simulation primitives for KD Hybrid.
//!
//! The crate deliberately has no serialization framework or platform
//! dependency. The JS/WASM boundary uses the compact protocol in [`protocol`].

pub mod buffs;
pub mod events;
pub mod mapgen;
pub mod model;
pub mod pathfinding;
pub mod plugin;
pub mod protocol;
pub mod rng;
pub mod simulation;
pub mod spatial;

pub use simulation::{Engine, EngineConfig, EngineError};

/// Version of the native binary protocol and optional plugin ABI.
pub const ABI_VERSION: u16 = 1;
