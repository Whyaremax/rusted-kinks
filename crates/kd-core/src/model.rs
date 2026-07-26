use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};

pub type EntityId = u32;

pub const TILE_BLOCKED: u8 = 1;
pub const ENTITY_DEAD: u32 = 1;

#[derive(Clone, Copy, Debug, Default, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct Position {
    pub x: i16,
    pub y: i16,
}

impl Position {
    #[must_use]
    pub const fn new(x: i16, y: i16) -> Self {
        Self { x, y }
    }

    #[must_use]
    pub fn manhattan(self, other: Self) -> u32 {
        u32::from(self.x.abs_diff(other.x)) + u32::from(self.y.abs_diff(other.y))
    }

    #[must_use]
    pub fn offset(self, dx: i16, dy: i16) -> Option<Self> {
        Some(Self {
            x: self.x.checked_add(dx)?,
            y: self.y.checked_add(dy)?,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Grid {
    width: u16,
    height: u16,
    tiles: Vec<u8>,
}

impl Grid {
    pub fn new(width: u16, height: u16) -> Result<Self, ModelError> {
        validate_dimensions(width, height)?;
        let len = usize::from(width) * usize::from(height);
        Ok(Self {
            width,
            height,
            tiles: vec![0; len],
        })
    }

    pub fn from_tiles(width: u16, height: u16, tiles: Vec<u8>) -> Result<Self, ModelError> {
        validate_dimensions(width, height)?;
        let expected = usize::from(width) * usize::from(height);
        if tiles.len() != expected {
            return Err(ModelError::TileCount {
                expected,
                actual: tiles.len(),
            });
        }
        Ok(Self {
            width,
            height,
            tiles,
        })
    }

    #[must_use]
    pub const fn width(&self) -> u16 {
        self.width
    }

    #[must_use]
    pub const fn height(&self) -> u16 {
        self.height
    }

    #[must_use]
    pub fn tiles(&self) -> &[u8] {
        &self.tiles
    }

    #[must_use]
    pub fn into_tiles(self) -> Vec<u8> {
        self.tiles
    }

    #[must_use]
    pub fn contains(&self, position: Position) -> bool {
        position.x >= 0
            && position.y >= 0
            && u16::try_from(position.x).is_ok_and(|x| x < self.width)
            && u16::try_from(position.y).is_ok_and(|y| y < self.height)
    }

    #[must_use]
    pub fn index(&self, position: Position) -> Option<usize> {
        if !self.contains(position) {
            return None;
        }
        let x = usize::from(u16::try_from(position.x).ok()?);
        let y = usize::from(u16::try_from(position.y).ok()?);
        Some(y * usize::from(self.width) + x)
    }

    #[must_use]
    pub fn position(&self, index: usize) -> Option<Position> {
        if index >= self.tiles.len() {
            return None;
        }
        let width = usize::from(self.width);
        Some(Position {
            x: i16::try_from(index % width).ok()?,
            y: i16::try_from(index / width).ok()?,
        })
    }

    #[must_use]
    pub fn is_walkable(&self, position: Position) -> bool {
        self.index(position)
            .is_some_and(|index| self.tiles[index] & TILE_BLOCKED == 0)
    }

    pub fn set_blocked(&mut self, position: Position, blocked: bool) -> Result<(), ModelError> {
        let index = self
            .index(position)
            .ok_or(ModelError::OutOfBounds(position))?;
        if blocked {
            self.tiles[index] |= TILE_BLOCKED;
        } else {
            self.tiles[index] &= !TILE_BLOCKED;
        }
        Ok(())
    }
}

fn validate_dimensions(width: u16, height: u16) -> Result<(), ModelError> {
    if width == 0 || height == 0 || width > 4_096 || height > 4_096 {
        return Err(ModelError::Dimensions(width, height));
    }
    Ok(())
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Entity {
    pub id: EntityId,
    pub generation: u32,
    pub position: Position,
    pub hp: i32,
    pub max_hp: i32,
    pub faction: u16,
    pub flags: u32,
}

impl Entity {
    #[must_use]
    pub const fn is_alive(&self) -> bool {
        self.hp > 0 && self.flags & ENTITY_DEAD == 0
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct World {
    pub turn: u64,
    pub seed: u64,
    pub grid: Grid,
    entities: BTreeMap<EntityId, Entity>,
}

impl World {
    #[must_use]
    pub fn new(grid: Grid, seed: u64) -> Self {
        Self {
            turn: 0,
            seed,
            grid,
            entities: BTreeMap::new(),
        }
    }

    pub fn insert_entity(&mut self, entity: Entity) -> Result<(), ModelError> {
        if !self.grid.is_walkable(entity.position) {
            return Err(ModelError::Blocked(entity.position));
        }
        if self
            .entities
            .values()
            .any(|other| other.is_alive() && other.position == entity.position)
        {
            return Err(ModelError::Occupied(entity.position));
        }
        if entity.max_hp <= 0 || entity.hp > entity.max_hp {
            return Err(ModelError::HitPoints(entity.id));
        }
        if self.entities.insert(entity.id, entity).is_some() {
            return Err(ModelError::DuplicateEntity);
        }
        Ok(())
    }

    #[must_use]
    pub fn entity(&self, id: EntityId) -> Option<&Entity> {
        self.entities.get(&id)
    }

    #[must_use]
    pub fn entity_mut(&mut self, id: EntityId) -> Option<&mut Entity> {
        self.entities.get_mut(&id)
    }

    #[must_use]
    pub fn entities(&self) -> impl ExactSizeIterator<Item = &Entity> {
        self.entities.values()
    }

    #[must_use]
    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }

    #[must_use]
    pub fn is_occupied_except(&self, position: Position, except: EntityId) -> bool {
        self.entities
            .values()
            .any(|entity| entity.id != except && entity.is_alive() && entity.position == position)
    }

    pub fn remove_entity(&mut self, id: EntityId) -> Option<Entity> {
        self.entities.remove(&id)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ModelError {
    Dimensions(u16, u16),
    TileCount { expected: usize, actual: usize },
    OutOfBounds(Position),
    Blocked(Position),
    Occupied(Position),
    HitPoints(EntityId),
    DuplicateEntity,
}

impl Display for ModelError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Dimensions(width, height) => {
                write!(formatter, "invalid grid dimensions {width}x{height}")
            }
            Self::TileCount { expected, actual } => {
                write!(formatter, "expected {expected} tiles but received {actual}")
            }
            Self::OutOfBounds(position) => {
                write!(
                    formatter,
                    "position {},{} is out of bounds",
                    position.x, position.y
                )
            }
            Self::Blocked(position) => {
                write!(
                    formatter,
                    "position {},{} is blocked",
                    position.x, position.y
                )
            }
            Self::Occupied(position) => {
                write!(
                    formatter,
                    "position {},{} is occupied",
                    position.x, position.y
                )
            }
            Self::HitPoints(id) => write!(formatter, "entity {id} has invalid hit points"),
            Self::DuplicateEntity => formatter.write_str("duplicate entity id"),
        }
    }
}

impl std::error::Error for ModelError {}

#[cfg(test)]
mod tests {
    use super::{Entity, Grid, ModelError, Position, World};

    #[test]
    fn grid_rejects_invalid_shape() {
        assert!(matches!(Grid::new(0, 5), Err(ModelError::Dimensions(..))));
        assert!(matches!(
            Grid::from_tiles(2, 2, vec![0; 3]),
            Err(ModelError::TileCount { .. })
        ));
    }

    #[test]
    fn world_rejects_occupied_tiles() {
        let mut world = World::new(Grid::new(4, 4).expect("grid"), 1);
        let entity = Entity {
            id: 1,
            generation: 0,
            position: Position::new(1, 1),
            hp: 3,
            max_hp: 3,
            faction: 1,
            flags: 0,
        };
        world.insert_entity(entity.clone()).expect("first entity");
        assert!(matches!(
            world.insert_entity(Entity { id: 2, ..entity }),
            Err(ModelError::Occupied(..))
        ));
    }
}
