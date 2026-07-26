use crate::model::{EntityId, Position, World};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpatialIndex {
    width: u16,
    height: u16,
    cells: Vec<Vec<EntityId>>,
}

impl SpatialIndex {
    #[must_use]
    pub fn new(width: u16, height: u16) -> Self {
        Self {
            width,
            height,
            cells: vec![Vec::new(); usize::from(width) * usize::from(height)],
        }
    }

    #[must_use]
    pub fn from_world(world: &World) -> Self {
        let mut index = Self::new(world.grid.width(), world.grid.height());
        for entity in world.entities().filter(|entity| entity.is_alive()) {
            index.insert(entity.id, entity.position);
        }
        index
    }

    fn index(&self, position: Position) -> Option<usize> {
        if position.x < 0 || position.y < 0 {
            return None;
        }
        let x = u16::try_from(position.x).ok()?;
        let y = u16::try_from(position.y).ok()?;
        if x >= self.width || y >= self.height {
            return None;
        }
        Some(usize::from(y) * usize::from(self.width) + usize::from(x))
    }

    pub fn insert(&mut self, id: EntityId, position: Position) {
        if let Some(index) = self.index(position) {
            let cell = &mut self.cells[index];
            if let Err(offset) = cell.binary_search(&id) {
                cell.insert(offset, id);
            }
        }
    }

    pub fn remove(&mut self, id: EntityId, position: Position) {
        if let Some(index) = self.index(position)
            && let Ok(offset) = self.cells[index].binary_search(&id)
        {
            self.cells[index].remove(offset);
        }
    }

    pub fn move_entity(&mut self, id: EntityId, from: Position, to: Position) {
        self.remove(id, from);
        self.insert(id, to);
    }

    #[must_use]
    pub fn at(&self, position: Position) -> &[EntityId] {
        self.index(position)
            .map_or(&[], |index| self.cells[index].as_slice())
    }

    #[must_use]
    pub fn in_radius(&self, origin: Position, radius: u16) -> Vec<EntityId> {
        let radius_i32 = i32::from(radius);
        let mut result = Vec::new();
        for dy in -radius_i32..=radius_i32 {
            let remaining = radius_i32 - dy.abs();
            for dx in -remaining..=remaining {
                let Some(x) = i32::from(origin.x)
                    .checked_add(dx)
                    .and_then(|value| i16::try_from(value).ok())
                else {
                    continue;
                };
                let Some(y) = i32::from(origin.y)
                    .checked_add(dy)
                    .and_then(|value| i16::try_from(value).ok())
                else {
                    continue;
                };
                result.extend_from_slice(self.at(Position::new(x, y)));
            }
        }
        result.sort_unstable();
        result.dedup();
        result
    }
}

#[cfg(test)]
mod tests {
    use crate::model::{Entity, Grid, Position, World};

    use super::SpatialIndex;

    #[test]
    fn updates_cells_and_radius_deterministically() {
        let mut world = World::new(Grid::new(8, 8).expect("grid"), 4);
        for (id, x) in [(4, 2), (1, 3), (9, 6)] {
            world
                .insert_entity(Entity {
                    id,
                    generation: 0,
                    position: Position::new(x, 2),
                    hp: 1,
                    max_hp: 1,
                    faction: 0,
                    flags: 0,
                })
                .expect("entity");
        }
        let mut index = SpatialIndex::from_world(&world);
        assert_eq!(index.in_radius(Position::new(2, 2), 1), vec![1, 4]);
        index.move_entity(4, Position::new(2, 2), Position::new(5, 5));
        assert_eq!(index.at(Position::new(2, 2)), &[]);
        assert_eq!(index.at(Position::new(5, 5)), &[4]);
    }
}
