//! Small deterministic random-number generator.

/// `SplitMix64` is fast, deterministic on every target, and sufficient for game
/// simulation and fixture generation. It is not a cryptographic RNG.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DeterministicRng {
    state: u64,
}

impl DeterministicRng {
    #[must_use]
    pub const fn new(seed: u64) -> Self {
        Self {
            state: seed ^ 0x9E37_79B9_7F4A_7C15,
        }
    }

    #[must_use]
    pub const fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut value = self.state;
        value = (value ^ (value >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        value = (value ^ (value >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        value ^ (value >> 31)
    }

    #[must_use]
    pub const fn next_u32(&mut self) -> u32 {
        let [low0, low1, low2, low3, _, _, _, _] = self.next_u64().to_le_bytes();
        u32::from_le_bytes([low0, low1, low2, low3])
    }

    #[must_use]
    pub fn range_u32(&mut self, upper_exclusive: u32) -> u32 {
        if upper_exclusive == 0 {
            return 0;
        }
        // Lemire's multiply-high mapping avoids modulo bias.
        ((u64::from(self.next_u32()) * u64::from(upper_exclusive)) >> 32) as u32
    }

    #[must_use]
    pub fn chance(&mut self, numerator: u32, denominator: u32) -> bool {
        denominator != 0 && self.range_u32(denominator) < numerator
    }

    #[must_use]
    pub const fn state(self) -> u64 {
        self.state
    }
}

#[cfg(test)]
mod tests {
    use super::DeterministicRng;

    #[test]
    fn same_seed_produces_same_sequence() {
        let mut left = DeterministicRng::new(42);
        let mut right = DeterministicRng::new(42);
        for _ in 0..1_000 {
            assert_eq!(left.next_u64(), right.next_u64());
        }
    }

    #[test]
    fn range_stays_bounded() {
        let mut rng = DeterministicRng::new(9);
        for _ in 0..10_000 {
            assert!(rng.range_u32(7) < 7);
        }
        assert_eq!(rng.range_u32(0), 0);
    }
}
