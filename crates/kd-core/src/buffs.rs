use std::collections::BTreeMap;

use crate::model::EntityId;

pub const BUFF_TICK_DAMAGE: u32 = 1;
pub const BUFF_TICK_HEAL: u32 = 2;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Buff {
    pub kind: u32,
    pub remaining: i16,
    pub stacks: i16,
    pub magnitude: i32,
    pub flags: u32,
}

impl Buff {
    #[must_use]
    pub const fn active(self) -> bool {
        self.remaining > 0 && self.stacks > 0
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct BuffStore {
    by_entity: BTreeMap<EntityId, Vec<Buff>>,
}

impl BuffStore {
    pub fn add(&mut self, entity: EntityId, buff: Buff) {
        if !buff.active() {
            return;
        }
        let buffs = self.by_entity.entry(entity).or_default();
        if let Some(existing) = buffs
            .iter_mut()
            .find(|existing| existing.kind == buff.kind && existing.flags == buff.flags)
        {
            existing.remaining = existing.remaining.max(buff.remaining);
            existing.stacks = existing.stacks.saturating_add(buff.stacks);
            existing.magnitude = existing.magnitude.max(buff.magnitude);
        } else {
            buffs.push(buff);
            buffs.sort_unstable_by_key(|entry| (entry.kind, entry.flags));
        }
    }

    #[must_use]
    pub fn for_entity(&self, entity: EntityId) -> &[Buff] {
        self.by_entity.get(&entity).map_or(&[], Vec::as_slice)
    }

    pub fn entities(&self) -> impl Iterator<Item = (EntityId, &[Buff])> {
        self.by_entity
            .iter()
            .map(|(entity, buffs)| (*entity, buffs.as_slice()))
    }

    /// Decrements active buffs and returns each pre-decrement buff for effect
    /// application. Only entities with buffs are visited.
    pub fn tick(&mut self) -> Vec<(EntityId, Buff)> {
        let mut effects = Vec::new();
        self.by_entity.retain(|entity, buffs| {
            for buff in &mut *buffs {
                if buff.active() {
                    effects.push((*entity, *buff));
                    buff.remaining = buff.remaining.saturating_sub(1);
                }
            }
            buffs.retain(|buff| buff.active());
            !buffs.is_empty()
        });
        effects
    }

    pub fn remove_entity(&mut self, entity: EntityId) {
        self.by_entity.remove(&entity);
    }
}

#[cfg(test)]
mod tests {
    use super::{BUFF_TICK_DAMAGE, Buff, BuffStore};

    #[test]
    fn merges_and_expires_buffs() {
        let mut store = BuffStore::default();
        store.add(
            7,
            Buff {
                kind: 2,
                remaining: 2,
                stacks: 1,
                magnitude: 3,
                flags: BUFF_TICK_DAMAGE,
            },
        );
        store.add(
            7,
            Buff {
                kind: 2,
                remaining: 1,
                stacks: 2,
                magnitude: 2,
                flags: BUFF_TICK_DAMAGE,
            },
        );
        assert_eq!(store.for_entity(7)[0].stacks, 3);
        assert_eq!(store.tick().len(), 1);
        assert_eq!(store.tick().len(), 1);
        assert!(store.for_entity(7).is_empty());
    }
}
