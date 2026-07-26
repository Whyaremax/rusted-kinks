use std::fmt::{Display, Formatter};

use crate::buffs::{BUFF_TICK_DAMAGE, BUFF_TICK_HEAL, BuffStore};
use crate::events::{Event, EventKind, EventQueue};
use crate::model::{ENTITY_DEAD, EntityId, Grid, ModelError, Position, World};
use crate::pathfinding::{PathResult, find_grid_path, find_path};
use crate::protocol::{
    Command, CommandBatch, PathStatus, ProtocolError, Query, QueryResponse, Snapshot, StepResponse,
    decode_commands, decode_query, decode_snapshot, encode_query_response, encode_snapshot,
    encode_step_response,
};
use crate::rng::DeterministicRng;
use crate::spatial::SpatialIndex;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct EngineConfig {
    pub event_capacity: usize,
    pub ai_path_budget: u32,
    pub ai_damage: i32,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            event_capacity: 65_536,
            ai_path_budget: 4_096,
            ai_damage: 1,
        }
    }
}

#[derive(Debug)]
pub struct Engine {
    world: World,
    buffs: BuffStore,
    spatial: SpatialIndex,
    events: EventQueue,
    rng: DeterministicRng,
    config: EngineConfig,
}

impl Engine {
    pub fn new(width: u16, height: u16, seed: u64) -> Result<Self, EngineError> {
        Self::with_config(width, height, seed, EngineConfig::default())
    }

    pub fn with_config(
        width: u16,
        height: u16,
        seed: u64,
        config: EngineConfig,
    ) -> Result<Self, EngineError> {
        let world = World::new(Grid::new(width, height)?, seed);
        Ok(Self {
            spatial: SpatialIndex::from_world(&world),
            events: EventQueue::new(config.event_capacity),
            buffs: BuffStore::default(),
            rng: DeterministicRng::new(seed),
            world,
            config,
        })
    }

    #[must_use]
    pub const fn world(&self) -> &World {
        &self.world
    }

    #[must_use]
    pub const fn buffs(&self) -> &BuffStore {
        &self.buffs
    }

    pub fn load_snapshot(&mut self, snapshot: Snapshot) -> Result<(), EngineError> {
        let grid = Grid::from_tiles(snapshot.width, snapshot.height, snapshot.tiles)?;
        let mut world = World::new(grid, snapshot.seed);
        world.turn = snapshot.turn;
        for entity in snapshot.entities {
            world.insert_entity(entity)?;
        }
        let mut buffs = BuffStore::default();
        for (entity, buff) in snapshot.buffs {
            if world.entity(entity).is_none() {
                return Err(EngineError::UnknownEntity(entity));
            }
            buffs.add(entity, buff);
        }
        self.rng = DeterministicRng::new(snapshot.seed ^ snapshot.turn);
        self.spatial = SpatialIndex::from_world(&world);
        self.events = EventQueue::new(self.config.event_capacity);
        self.buffs = buffs;
        self.world = world;
        Ok(())
    }

    pub fn load_snapshot_bytes(&mut self, bytes: &[u8]) -> Result<(), EngineError> {
        self.load_snapshot(decode_snapshot(bytes)?)
    }

    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            width: self.world.grid.width(),
            height: self.world.grid.height(),
            turn: self.world.turn,
            seed: self.world.seed,
            tiles: self.world.grid.tiles().to_vec(),
            entities: self.world.entities().cloned().collect(),
            buffs: self
                .buffs
                .entities()
                .flat_map(|(entity, buffs)| buffs.iter().map(move |buff| (entity, *buff)))
                .collect(),
        }
    }

    pub fn snapshot_bytes(&self) -> Result<Vec<u8>, EngineError> {
        Ok(encode_snapshot(&self.snapshot())?)
    }

    pub fn step_bytes(&mut self, bytes: &[u8]) -> Result<Vec<u8>, EngineError> {
        let response = self.step(decode_commands(bytes)?)?;
        Ok(encode_step_response(&response)?)
    }

    pub fn query_bytes(&self, bytes: &[u8]) -> Result<Vec<u8>, EngineError> {
        let response = self.query(decode_query(bytes)?)?;
        Ok(encode_query_response(&response)?)
    }

    pub fn step(&mut self, batch: CommandBatch) -> Result<StepResponse, EngineError> {
        if batch.expected_turn != self.world.turn {
            return Err(EngineError::StaleTurn {
                expected: self.world.turn,
                received: batch.expected_turn,
            });
        }

        self.events.push(Event {
            kind: EventKind::TurnStarted,
            actor: 0,
            target: 0,
            position: Position::default(),
            value: i32::try_from(self.world.turn).unwrap_or(i32::MAX),
            detail: 0,
        });
        for command in batch.commands {
            self.apply(command)?;
        }
        self.tick_buffs();
        self.world.turn = self.world.turn.saturating_add(1);
        self.events.push(Event {
            kind: EventKind::TurnEnded,
            actor: 0,
            target: 0,
            position: Position::default(),
            value: i32::try_from(self.world.turn).unwrap_or(i32::MAX),
            detail: 0,
        });

        Ok(StepResponse {
            turn: self.world.turn,
            dropped_events: self.events.dropped(),
            events: self.events.drain(),
        })
    }

    pub fn query(&self, query: Query) -> Result<QueryResponse, EngineError> {
        match query {
            Query::Path {
                entity,
                goal,
                max_visited,
            } => {
                let actor = self
                    .world
                    .entity(entity)
                    .ok_or(EngineError::UnknownEntity(entity))?;
                let result = find_path(
                    &self.world.grid,
                    actor.position,
                    goal,
                    max_visited.min(1_000_000),
                    |position| self.world.is_occupied_except(position, entity),
                );
                Ok(match result {
                    PathResult::Found(positions) => QueryResponse::Path {
                        status: PathStatus::Found,
                        visited: u32::try_from(positions.len()).unwrap_or(u32::MAX),
                        positions,
                    },
                    PathResult::Unreachable { visited } => QueryResponse::Path {
                        status: PathStatus::Unreachable,
                        visited,
                        positions: Vec::new(),
                    },
                    PathResult::BudgetExceeded { visited } => QueryResponse::Path {
                        status: PathStatus::BudgetExceeded,
                        visited,
                        positions: Vec::new(),
                    },
                })
            }
            Query::GridPath {
                start,
                goal,
                max_visited,
                diagonal,
            } => {
                let result = find_grid_path(
                    &self.world.grid,
                    start,
                    goal,
                    max_visited.min(1_000_000),
                    diagonal,
                );
                Ok(match result {
                    PathResult::Found(positions) => QueryResponse::Path {
                        status: PathStatus::Found,
                        visited: u32::try_from(positions.len()).unwrap_or(u32::MAX),
                        positions,
                    },
                    PathResult::Unreachable { visited } => QueryResponse::Path {
                        status: PathStatus::Unreachable,
                        visited,
                        positions: Vec::new(),
                    },
                    PathResult::BudgetExceeded { visited } => QueryResponse::Path {
                        status: PathStatus::BudgetExceeded,
                        visited,
                        positions: Vec::new(),
                    },
                })
            }
            Query::Nearby { origin, radius } => Ok(QueryResponse::Entities(
                self.spatial.in_radius(origin, radius.min(4_096)),
            )),
        }
    }

    fn apply(&mut self, command: Command) -> Result<(), EngineError> {
        match command {
            Command::Move { entity, dx, dy } => self.move_entity(entity, dx, dy),
            Command::Damage {
                actor,
                target,
                amount,
            } => self.damage(actor, target, amount),
            Command::Heal {
                actor,
                target,
                amount,
            } => self.heal(actor, target, amount),
            Command::AddBuff {
                actor,
                target,
                buff,
            } => {
                let target_position = self
                    .world
                    .entity(target)
                    .ok_or(EngineError::UnknownEntity(target))?
                    .position;
                self.buffs.add(target, buff);
                self.events.push(Event {
                    kind: EventKind::BuffAdded,
                    actor,
                    target,
                    position: target_position,
                    value: buff.magnitude,
                    detail: buff.kind,
                });
                Ok(())
            }
            Command::Wait { entity } => {
                let position = self
                    .world
                    .entity(entity)
                    .ok_or(EngineError::UnknownEntity(entity))?
                    .position;
                self.events.push(Event {
                    kind: EventKind::Waited,
                    actor: entity,
                    target: 0,
                    position,
                    value: 0,
                    detail: 0,
                });
                Ok(())
            }
            Command::RunAi { faction } => self.run_ai(faction),
        }
    }

    fn move_entity(&mut self, entity: EntityId, dx: i16, dy: i16) -> Result<(), EngineError> {
        if dx.unsigned_abs().saturating_add(dy.unsigned_abs()) != 1 {
            return Err(EngineError::InvalidMove(dx, dy));
        }
        let from = self
            .world
            .entity(entity)
            .ok_or(EngineError::UnknownEntity(entity))?
            .position;
        let Some(to) = from.offset(dx, dy) else {
            return Err(EngineError::InvalidMove(dx, dy));
        };
        if !self.world.grid.is_walkable(to) || self.world.is_occupied_except(to, entity) {
            self.events.push(Event {
                kind: EventKind::Blocked,
                actor: entity,
                target: 0,
                position: to,
                value: 0,
                detail: 0,
            });
            return Ok(());
        }
        self.world
            .entity_mut(entity)
            .expect("entity was checked")
            .position = to;
        self.spatial.move_entity(entity, from, to);
        self.events.push(Event {
            kind: EventKind::Moved,
            actor: entity,
            target: 0,
            position: to,
            value: 0,
            detail: 0,
        });
        Ok(())
    }

    fn damage(
        &mut self,
        actor: EntityId,
        target: EntityId,
        amount: i32,
    ) -> Result<(), EngineError> {
        if amount < 0 {
            return Err(EngineError::InvalidAmount(amount));
        }
        let entity = self
            .world
            .entity_mut(target)
            .ok_or(EngineError::UnknownEntity(target))?;
        let position = entity.position;
        let was_alive = entity.is_alive();
        entity.hp = entity.hp.saturating_sub(amount).max(0);
        self.events.push(Event {
            kind: EventKind::Damaged,
            actor,
            target,
            position,
            value: amount,
            detail: self.rng.next_u32(),
        });
        if was_alive && entity.hp == 0 {
            entity.flags |= ENTITY_DEAD;
            self.spatial.remove(target, position);
            self.buffs.remove_entity(target);
            self.events.push(Event {
                kind: EventKind::Died,
                actor,
                target,
                position,
                value: 0,
                detail: 0,
            });
        }
        Ok(())
    }

    fn heal(&mut self, actor: EntityId, target: EntityId, amount: i32) -> Result<(), EngineError> {
        if amount < 0 {
            return Err(EngineError::InvalidAmount(amount));
        }
        let entity = self
            .world
            .entity_mut(target)
            .ok_or(EngineError::UnknownEntity(target))?;
        if !entity.is_alive() {
            return Ok(());
        }
        let before = entity.hp;
        entity.hp = entity.hp.saturating_add(amount).min(entity.max_hp);
        self.events.push(Event {
            kind: EventKind::Healed,
            actor,
            target,
            position: entity.position,
            value: entity.hp - before,
            detail: 0,
        });
        Ok(())
    }

    fn tick_buffs(&mut self) {
        for (target, buff) in self.buffs.tick() {
            let amount = buff.magnitude.saturating_mul(i32::from(buff.stacks));
            if buff.flags & BUFF_TICK_DAMAGE != 0 {
                let _ = self.damage(target, target, amount.max(0));
            } else if buff.flags & BUFF_TICK_HEAL != 0 {
                let _ = self.heal(target, target, amount.max(0));
            }
            let position = self
                .world
                .entity(target)
                .map_or_else(Position::default, |entity| entity.position);
            self.events.push(Event {
                kind: EventKind::BuffTicked,
                actor: target,
                target,
                position,
                value: amount,
                detail: buff.kind,
            });
        }
    }

    fn run_ai(&mut self, faction: u16) -> Result<(), EngineError> {
        let actors: Vec<EntityId> = self
            .world
            .entities()
            .filter(|entity| entity.is_alive() && entity.faction == faction)
            .map(|entity| entity.id)
            .collect();
        for actor_id in actors {
            let Some(actor) = self.world.entity(actor_id).cloned() else {
                continue;
            };
            let target = self
                .world
                .entities()
                .filter(|candidate| candidate.is_alive() && candidate.faction != faction)
                .min_by_key(|candidate| {
                    (actor.position.manhattan(candidate.position), candidate.id)
                })
                .cloned();
            let Some(target) = target else {
                continue;
            };
            if actor.position.manhattan(target.position) == 1 {
                self.damage(actor_id, target.id, self.config.ai_damage)?;
                continue;
            }
            let path = find_path(
                &self.world.grid,
                actor.position,
                target.position,
                self.config.ai_path_budget,
                |position| self.world.is_occupied_except(position, actor_id),
            );
            if let PathResult::Found(path) = path
                && let Some(next) = path.get(1)
            {
                self.move_entity(
                    actor_id,
                    next.x.saturating_sub(actor.position.x),
                    next.y.saturating_sub(actor.position.y),
                )?;
            }
        }
        Ok(())
    }
}

#[derive(Debug)]
pub enum EngineError {
    Model(ModelError),
    Protocol(ProtocolError),
    UnknownEntity(EntityId),
    StaleTurn { expected: u64, received: u64 },
    InvalidMove(i16, i16),
    InvalidAmount(i32),
}

impl Display for EngineError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Model(error) => Display::fmt(error, formatter),
            Self::Protocol(error) => Display::fmt(error, formatter),
            Self::UnknownEntity(entity) => write!(formatter, "unknown entity {entity}"),
            Self::StaleTurn { expected, received } => {
                write!(
                    formatter,
                    "expected turn {expected} but received {received}"
                )
            }
            Self::InvalidMove(dx, dy) => write!(formatter, "invalid move delta {dx},{dy}"),
            Self::InvalidAmount(amount) => write!(formatter, "invalid negative amount {amount}"),
        }
    }
}

impl std::error::Error for EngineError {}

impl From<ModelError> for EngineError {
    fn from(error: ModelError) -> Self {
        Self::Model(error)
    }
}

impl From<ProtocolError> for EngineError {
    fn from(error: ProtocolError) -> Self {
        Self::Protocol(error)
    }
}

#[cfg(test)]
mod tests {
    use crate::buffs::{BUFF_TICK_DAMAGE, Buff};
    use crate::events::EventKind;
    use crate::model::{Entity, Position};
    use crate::protocol::{Command, CommandBatch, Query};

    use super::Engine;

    fn fixture() -> Engine {
        let mut engine = Engine::new(12, 8, 42).expect("engine");
        let mut snapshot = engine.snapshot();
        snapshot.entities = vec![
            Entity {
                id: 1,
                generation: 0,
                position: Position::new(1, 1),
                hp: 10,
                max_hp: 10,
                faction: 1,
                flags: 0,
            },
            Entity {
                id: 2,
                generation: 0,
                position: Position::new(5, 1),
                hp: 6,
                max_hp: 6,
                faction: 2,
                flags: 0,
            },
        ];
        engine.load_snapshot(snapshot).expect("load");
        engine
    }

    #[test]
    fn executes_batched_turn_and_ticks_buffs() {
        let mut engine = fixture();
        let response = engine
            .step(CommandBatch {
                expected_turn: 0,
                commands: vec![
                    Command::Move {
                        entity: 1,
                        dx: 1,
                        dy: 0,
                    },
                    Command::AddBuff {
                        actor: 1,
                        target: 2,
                        buff: Buff {
                            kind: 9,
                            remaining: 1,
                            stacks: 1,
                            magnitude: 2,
                            flags: BUFF_TICK_DAMAGE,
                        },
                    },
                ],
            })
            .expect("step");
        assert_eq!(response.turn, 1);
        assert!(
            response
                .events
                .iter()
                .any(|event| event.kind == EventKind::Moved)
        );
        assert_eq!(engine.world().entity(2).expect("target").hp, 4);
        assert!(engine.buffs().for_entity(2).is_empty());
    }

    #[test]
    fn ai_moves_toward_hostile_then_attacks() {
        let mut engine = fixture();
        for turn in 0..4 {
            engine
                .step(CommandBatch {
                    expected_turn: turn,
                    commands: vec![Command::RunAi { faction: 1 }],
                })
                .expect("AI turn");
        }
        assert!(engine.world().entity(2).expect("target").hp < 6);
    }

    #[test]
    fn query_finds_nearby_entities_and_path() {
        let engine = fixture();
        let nearby = engine
            .query(Query::Nearby {
                origin: Position::new(1, 1),
                radius: 4,
            })
            .expect("nearby");
        assert!(matches!(
            nearby,
            crate::protocol::QueryResponse::Entities(ref ids) if ids == &[1, 2]
        ));
        let path = engine
            .query(Query::Path {
                entity: 1,
                goal: Position::new(4, 1),
                max_visited: 100,
            })
            .expect("path");
        assert!(matches!(
            path,
            crate::protocol::QueryResponse::Path {
                status: crate::protocol::PathStatus::Found,
                ..
            }
        ));
    }

    #[test]
    fn grid_path_query_does_not_require_an_entity() {
        let engine = fixture();
        let path = engine
            .query(Query::GridPath {
                start: Position::new(0, 0),
                goal: Position::new(3, 3),
                max_visited: 100,
                diagonal: true,
            })
            .expect("grid path");
        assert!(matches!(
            path,
            crate::protocol::QueryResponse::Path {
                status: crate::protocol::PathStatus::Found,
                ..
            }
        ));
    }

    #[test]
    fn snapshot_bytes_round_trip() {
        let engine = fixture();
        let bytes = engine.snapshot_bytes().expect("encode");
        let mut restored = Engine::new(1, 1, 0).expect("engine");
        restored.load_snapshot_bytes(&bytes).expect("decode");
        assert_eq!(restored.snapshot(), engine.snapshot());
    }
}
