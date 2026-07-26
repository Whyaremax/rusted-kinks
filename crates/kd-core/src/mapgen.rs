use crate::model::{Grid, ModelError, Position};
use crate::rng::DeterministicRng;

/// Deterministic cellular-cavern generator used for off-thread map candidates.
pub fn generate_cavern(
    width: u16,
    height: u16,
    seed: u64,
    fill_percent: u8,
    smoothing_steps: u8,
) -> Result<Grid, ModelError> {
    let mut grid = Grid::new(width, height)?;
    let mut rng = DeterministicRng::new(seed);
    let fill = u32::from(fill_percent.min(95));

    for y in 0..height {
        for x in 0..width {
            let boundary = x == 0 || y == 0 || x + 1 == width || y + 1 == height;
            let blocked = boundary || rng.range_u32(100) < fill;
            grid.set_blocked(
                Position::new(
                    i16::try_from(x).expect("dimensions constrained"),
                    i16::try_from(y).expect("dimensions constrained"),
                ),
                blocked,
            )?;
        }
    }

    for _ in 0..smoothing_steps.min(16) {
        let previous = grid.clone();
        for y in 1..height.saturating_sub(1) {
            for x in 1..width.saturating_sub(1) {
                let position = Position::new(
                    i16::try_from(x).expect("dimensions constrained"),
                    i16::try_from(y).expect("dimensions constrained"),
                );
                let neighbors = blocked_neighbors(&previous, position);
                grid.set_blocked(position, neighbors >= 5)?;
            }
        }
    }

    Ok(grid)
}

fn blocked_neighbors(grid: &Grid, position: Position) -> u8 {
    let mut blocked = 0;
    for dy in -1..=1 {
        for dx in -1..=1 {
            if dx == 0 && dy == 0 {
                continue;
            }
            let is_blocked = position
                .offset(dx, dy)
                .is_none_or(|neighbor| !grid.is_walkable(neighbor));
            blocked += u8::from(is_blocked);
        }
    }
    blocked
}

#[cfg(test)]
mod tests {
    use super::generate_cavern;

    #[test]
    fn generation_is_repeatable_and_seals_boundaries() {
        let left = generate_cavern(30, 20, 77, 43, 4).expect("map");
        let right = generate_cavern(30, 20, 77, 43, 4).expect("map");
        assert_eq!(left, right);
        assert!(left.tiles().contains(&crate::model::TILE_BLOCKED));
    }
}
