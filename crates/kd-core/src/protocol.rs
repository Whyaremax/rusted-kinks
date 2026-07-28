use std::fmt::{Display, Formatter};

use crate::ABI_VERSION;
use crate::buffs::Buff;
use crate::events::{Event, EventKind};
use crate::model::{Entity, EntityId, Position};
use crate::pathfinding::PathfindingMode;

const SNAPSHOT_MAGIC: [u8; 4] = *b"KDH1";
const COMMAND_MAGIC: [u8; 4] = *b"KDC1";
const RESPONSE_MAGIC: [u8; 4] = *b"KDR1";
const QUERY_MAGIC: [u8; 4] = *b"KDQ1";
const QUERY_RESPONSE_MAGIC: [u8; 4] = *b"KDZ1";

pub const MAX_ENTITIES: usize = 100_000;
pub const MAX_BUFFS: usize = 1_000_000;
pub const MAX_COMMANDS: usize = 1_000_000;
pub const MAX_EVENTS: usize = 1_000_000;
pub const MAX_TILES: usize = 16_777_216;
pub const MAX_PATH: usize = 1_000_000;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Snapshot {
    pub width: u16,
    pub height: u16,
    pub turn: u64,
    pub seed: u64,
    pub tiles: Vec<u8>,
    pub entities: Vec<Entity>,
    pub buffs: Vec<(EntityId, Buff)>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Command {
    Move {
        entity: EntityId,
        dx: i16,
        dy: i16,
    },
    Damage {
        actor: EntityId,
        target: EntityId,
        amount: i32,
    },
    Heal {
        actor: EntityId,
        target: EntityId,
        amount: i32,
    },
    AddBuff {
        actor: EntityId,
        target: EntityId,
        buff: Buff,
    },
    Wait {
        entity: EntityId,
    },
    RunAi {
        faction: u16,
    },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommandBatch {
    pub expected_turn: u64,
    pub commands: Vec<Command>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StepResponse {
    pub turn: u64,
    pub dropped_events: u32,
    pub events: Vec<Event>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Query {
    Path {
        entity: EntityId,
        goal: Position,
        max_visited: u32,
    },
    GridPath {
        start: Position,
        goal: Position,
        max_visited: u32,
        diagonal: bool,
        mode: PathfindingMode,
    },
    Nearby {
        origin: Position,
        radius: u16,
    },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum QueryResponse {
    Path {
        status: PathStatus,
        visited: u32,
        positions: Vec<Position>,
    },
    Entities(Vec<EntityId>),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum PathStatus {
    Found = 0,
    Unreachable = 1,
    BudgetExceeded = 2,
}

pub fn encode_snapshot(snapshot: &Snapshot) -> Result<Vec<u8>, ProtocolError> {
    validate_count("tiles", snapshot.tiles.len(), MAX_TILES)?;
    validate_count("entities", snapshot.entities.len(), MAX_ENTITIES)?;
    validate_count("buffs", snapshot.buffs.len(), MAX_BUFFS)?;
    let expected_tiles = usize::from(snapshot.width) * usize::from(snapshot.height);
    if snapshot.tiles.len() != expected_tiles {
        return Err(ProtocolError::InvalidValue(
            "tile count does not match dimensions",
        ));
    }

    let mut writer = Writer::new(SNAPSHOT_MAGIC);
    writer.u16(ABI_VERSION);
    writer.u16(snapshot.width);
    writer.u16(snapshot.height);
    writer.u16(0);
    writer.u64(snapshot.turn);
    writer.u64(snapshot.seed);
    writer.count(snapshot.tiles.len())?;
    writer.count(snapshot.entities.len())?;
    writer.count(snapshot.buffs.len())?;
    writer.bytes(&snapshot.tiles);
    for entity in &snapshot.entities {
        writer.u32(entity.id);
        writer.u32(entity.generation);
        writer.position(entity.position);
        writer.i32(entity.hp);
        writer.i32(entity.max_hp);
        writer.u16(entity.faction);
        writer.u16(0);
        writer.u32(entity.flags);
    }
    for (entity, buff) in &snapshot.buffs {
        writer.u32(*entity);
        writer.buff(*buff);
    }
    Ok(writer.finish())
}

pub fn decode_snapshot(bytes: &[u8]) -> Result<Snapshot, ProtocolError> {
    let mut reader = Reader::new(bytes, SNAPSHOT_MAGIC)?;
    reader.version()?;
    let width = reader.u16()?;
    let height = reader.u16()?;
    let _reserved = reader.u16()?;
    let turn = reader.u64()?;
    let seed = reader.u64()?;
    let tile_count = reader.count("tiles", MAX_TILES)?;
    let entity_count = reader.count("entities", MAX_ENTITIES)?;
    let buff_count = reader.count("buffs", MAX_BUFFS)?;
    if tile_count != usize::from(width) * usize::from(height) {
        return Err(ProtocolError::InvalidValue(
            "tile count does not match dimensions",
        ));
    }
    let tiles = reader.bytes(tile_count)?.to_vec();
    let mut entities = Vec::with_capacity(entity_count);
    for _ in 0..entity_count {
        entities.push(Entity {
            id: reader.u32()?,
            generation: reader.u32()?,
            position: reader.position()?,
            hp: reader.i32()?,
            max_hp: reader.i32()?,
            faction: reader.u16()?,
            flags: {
                let _reserved = reader.u16()?;
                reader.u32()?
            },
        });
    }
    let mut buffs = Vec::with_capacity(buff_count);
    for _ in 0..buff_count {
        buffs.push((reader.u32()?, reader.buff()?));
    }
    reader.finish()?;
    Ok(Snapshot {
        width,
        height,
        turn,
        seed,
        tiles,
        entities,
        buffs,
    })
}

pub fn encode_commands(batch: &CommandBatch) -> Result<Vec<u8>, ProtocolError> {
    validate_count("commands", batch.commands.len(), MAX_COMMANDS)?;
    let mut writer = Writer::new(COMMAND_MAGIC);
    writer.u16(ABI_VERSION);
    writer.u16(0);
    writer.u64(batch.expected_turn);
    writer.count(batch.commands.len())?;
    for command in &batch.commands {
        match *command {
            Command::Move { entity, dx, dy } => {
                writer.u8(1);
                writer.u8(0);
                writer.u16(0);
                writer.u32(entity);
                writer.i16(dx);
                writer.i16(dy);
            }
            Command::Damage {
                actor,
                target,
                amount,
            } => {
                writer.u8(2);
                writer.u8(0);
                writer.u16(0);
                writer.u32(actor);
                writer.u32(target);
                writer.i32(amount);
            }
            Command::Heal {
                actor,
                target,
                amount,
            } => {
                writer.u8(3);
                writer.u8(0);
                writer.u16(0);
                writer.u32(actor);
                writer.u32(target);
                writer.i32(amount);
            }
            Command::AddBuff {
                actor,
                target,
                buff,
            } => {
                writer.u8(4);
                writer.u8(0);
                writer.u16(0);
                writer.u32(actor);
                writer.u32(target);
                writer.buff(buff);
            }
            Command::Wait { entity } => {
                writer.u8(5);
                writer.u8(0);
                writer.u16(0);
                writer.u32(entity);
            }
            Command::RunAi { faction } => {
                writer.u8(6);
                writer.u8(0);
                writer.u16(faction);
            }
        }
    }
    Ok(writer.finish())
}

pub fn decode_commands(bytes: &[u8]) -> Result<CommandBatch, ProtocolError> {
    let mut reader = Reader::new(bytes, COMMAND_MAGIC)?;
    reader.version()?;
    let _reserved = reader.u16()?;
    let expected_turn = reader.u64()?;
    let count = reader.count("commands", MAX_COMMANDS)?;
    let mut commands = Vec::with_capacity(count);
    for _ in 0..count {
        let kind = reader.u8()?;
        let _flags = reader.u8()?;
        let detail = reader.u16()?;
        commands.push(match kind {
            1 => Command::Move {
                entity: reader.u32()?,
                dx: reader.i16()?,
                dy: reader.i16()?,
            },
            2 => Command::Damage {
                actor: reader.u32()?,
                target: reader.u32()?,
                amount: reader.i32()?,
            },
            3 => Command::Heal {
                actor: reader.u32()?,
                target: reader.u32()?,
                amount: reader.i32()?,
            },
            4 => Command::AddBuff {
                actor: reader.u32()?,
                target: reader.u32()?,
                buff: reader.buff()?,
            },
            5 => Command::Wait {
                entity: reader.u32()?,
            },
            6 => Command::RunAi { faction: detail },
            other => return Err(ProtocolError::UnknownTag(other)),
        });
    }
    reader.finish()?;
    Ok(CommandBatch {
        expected_turn,
        commands,
    })
}

pub fn encode_step_response(response: &StepResponse) -> Result<Vec<u8>, ProtocolError> {
    validate_count("events", response.events.len(), MAX_EVENTS)?;
    let mut writer = Writer::new(RESPONSE_MAGIC);
    writer.u16(ABI_VERSION);
    writer.u16(0);
    writer.u64(response.turn);
    writer.u32(response.dropped_events);
    writer.count(response.events.len())?;
    for event in &response.events {
        writer.event(*event);
    }
    Ok(writer.finish())
}

pub fn decode_step_response(bytes: &[u8]) -> Result<StepResponse, ProtocolError> {
    let mut reader = Reader::new(bytes, RESPONSE_MAGIC)?;
    reader.version()?;
    let _reserved = reader.u16()?;
    let turn = reader.u64()?;
    let dropped_events = reader.u32()?;
    let count = reader.count("events", MAX_EVENTS)?;
    let mut events = Vec::with_capacity(count);
    for _ in 0..count {
        events.push(reader.event()?);
    }
    reader.finish()?;
    Ok(StepResponse {
        turn,
        dropped_events,
        events,
    })
}

#[must_use]
pub fn encode_query(query: Query) -> Vec<u8> {
    let mut writer = Writer::new(QUERY_MAGIC);
    writer.u16(ABI_VERSION);
    match query {
        Query::Path {
            entity,
            goal,
            max_visited,
        } => {
            writer.u8(1);
            writer.u8(0);
            writer.u32(entity);
            writer.position(goal);
            writer.u32(max_visited);
        }
        Query::GridPath {
            start,
            goal,
            max_visited,
            diagonal,
            mode,
        } => {
            writer.u8(3);
            writer.u8(u8::from(diagonal) | mode.query_flags());
            writer.position(start);
            writer.position(goal);
            writer.u32(max_visited);
        }
        Query::Nearby { origin, radius } => {
            writer.u8(2);
            writer.u8(0);
            writer.position(origin);
            writer.u16(radius);
        }
    }
    writer.finish()
}

pub fn decode_query(bytes: &[u8]) -> Result<Query, ProtocolError> {
    let mut reader = Reader::new(bytes, QUERY_MAGIC)?;
    reader.version()?;
    let kind = reader.u8()?;
    let flags = reader.u8()?;
    let query = match kind {
        1 => Query::Path {
            entity: reader.u32()?,
            goal: reader.position()?,
            max_visited: reader.u32()?,
        },
        2 => Query::Nearby {
            origin: reader.position()?,
            radius: reader.u16()?,
        },
        3 => {
            if flags & !0b111 != 0 {
                return Err(ProtocolError::InvalidValue("grid path flags"));
            }
            let mode = PathfindingMode::from_query_flags(flags)
                .ok_or(ProtocolError::InvalidValue("pathfinding mode"))?;
            Query::GridPath {
                start: reader.position()?,
                goal: reader.position()?,
                max_visited: reader.u32()?,
                diagonal: flags & 1 != 0,
                mode,
            }
        }
        other => return Err(ProtocolError::UnknownTag(other)),
    };
    reader.finish()?;
    Ok(query)
}

pub fn encode_query_response(response: &QueryResponse) -> Result<Vec<u8>, ProtocolError> {
    let mut writer = Writer::new(QUERY_RESPONSE_MAGIC);
    writer.u16(ABI_VERSION);
    match response {
        QueryResponse::Path {
            status,
            visited,
            positions,
        } => {
            validate_count("path", positions.len(), MAX_PATH)?;
            writer.u8(1);
            writer.u8(*status as u8);
            writer.u32(*visited);
            writer.count(positions.len())?;
            for position in positions {
                writer.position(*position);
            }
        }
        QueryResponse::Entities(entities) => {
            validate_count("entities", entities.len(), MAX_ENTITIES)?;
            writer.u8(2);
            writer.u8(0);
            writer.count(entities.len())?;
            for entity in entities {
                writer.u32(*entity);
            }
        }
    }
    Ok(writer.finish())
}

pub fn decode_query_response(bytes: &[u8]) -> Result<QueryResponse, ProtocolError> {
    let mut reader = Reader::new(bytes, QUERY_RESPONSE_MAGIC)?;
    reader.version()?;
    let kind = reader.u8()?;
    let detail = reader.u8()?;
    let response = match kind {
        1 => {
            let status = match detail {
                0 => PathStatus::Found,
                1 => PathStatus::Unreachable,
                2 => PathStatus::BudgetExceeded,
                other => return Err(ProtocolError::UnknownTag(other)),
            };
            let visited = reader.u32()?;
            let count = reader.count("path", MAX_PATH)?;
            let mut positions = Vec::with_capacity(count);
            for _ in 0..count {
                positions.push(reader.position()?);
            }
            QueryResponse::Path {
                status,
                visited,
                positions,
            }
        }
        2 => {
            let count = reader.count("entities", MAX_ENTITIES)?;
            let mut entities = Vec::with_capacity(count);
            for _ in 0..count {
                entities.push(reader.u32()?);
            }
            QueryResponse::Entities(entities)
        }
        other => return Err(ProtocolError::UnknownTag(other)),
    };
    reader.finish()?;
    Ok(response)
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProtocolError {
    Truncated,
    TrailingBytes(usize),
    Magic([u8; 4]),
    Version(u16),
    Count {
        name: &'static str,
        count: usize,
        maximum: usize,
    },
    InvalidValue(&'static str),
    UnknownTag(u8),
}

impl Display for ProtocolError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Truncated => formatter.write_str("truncated protocol buffer"),
            Self::TrailingBytes(count) => write!(formatter, "{count} trailing protocol bytes"),
            Self::Magic(actual) => write!(formatter, "unexpected protocol magic {actual:?}"),
            Self::Version(version) => write!(formatter, "unsupported protocol version {version}"),
            Self::Count {
                name,
                count,
                maximum,
            } => write!(formatter, "{name} count {count} exceeds maximum {maximum}"),
            Self::InvalidValue(message) => formatter.write_str(message),
            Self::UnknownTag(tag) => write!(formatter, "unknown protocol tag {tag}"),
        }
    }
}

impl std::error::Error for ProtocolError {}

fn validate_count(name: &'static str, count: usize, maximum: usize) -> Result<(), ProtocolError> {
    if count > maximum || u32::try_from(count).is_err() {
        return Err(ProtocolError::Count {
            name,
            count,
            maximum,
        });
    }
    Ok(())
}

#[derive(Debug)]
struct Writer {
    bytes: Vec<u8>,
}

impl Writer {
    fn new(magic: [u8; 4]) -> Self {
        let mut bytes = Vec::with_capacity(256);
        bytes.extend_from_slice(&magic);
        Self { bytes }
    }

    fn u8(&mut self, value: u8) {
        self.bytes.push(value);
    }

    fn u16(&mut self, value: u16) {
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }

    fn i16(&mut self, value: i16) {
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }

    fn u32(&mut self, value: u32) {
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }

    fn i32(&mut self, value: i32) {
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }

    fn u64(&mut self, value: u64) {
        self.bytes.extend_from_slice(&value.to_le_bytes());
    }

    fn bytes(&mut self, bytes: &[u8]) {
        self.bytes.extend_from_slice(bytes);
    }

    fn count(&mut self, count: usize) -> Result<(), ProtocolError> {
        self.u32(u32::try_from(count).map_err(|_| ProtocolError::InvalidValue("count overflow"))?);
        Ok(())
    }

    fn position(&mut self, position: Position) {
        self.i16(position.x);
        self.i16(position.y);
    }

    fn buff(&mut self, buff: Buff) {
        self.u32(buff.kind);
        self.i16(buff.remaining);
        self.i16(buff.stacks);
        self.i32(buff.magnitude);
        self.u32(buff.flags);
    }

    fn event(&mut self, event: Event) {
        self.u8(event.kind as u8);
        self.u8(0);
        self.u16(0);
        self.u32(event.actor);
        self.u32(event.target);
        self.position(event.position);
        self.i32(event.value);
        self.u32(event.detail);
    }

    fn finish(self) -> Vec<u8> {
        self.bytes
    }
}

#[derive(Debug)]
struct Reader<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8], expected_magic: [u8; 4]) -> Result<Self, ProtocolError> {
        if bytes.len() < 4 {
            return Err(ProtocolError::Truncated);
        }
        let actual = [bytes[0], bytes[1], bytes[2], bytes[3]];
        if actual != expected_magic {
            return Err(ProtocolError::Magic(actual));
        }
        Ok(Self { bytes, offset: 4 })
    }

    fn take(&mut self, count: usize) -> Result<&'a [u8], ProtocolError> {
        let end = self
            .offset
            .checked_add(count)
            .ok_or(ProtocolError::Truncated)?;
        let result = self
            .bytes
            .get(self.offset..end)
            .ok_or(ProtocolError::Truncated)?;
        self.offset = end;
        Ok(result)
    }

    fn u8(&mut self) -> Result<u8, ProtocolError> {
        Ok(self.take(1)?[0])
    }

    fn u16(&mut self) -> Result<u16, ProtocolError> {
        Ok(u16::from_le_bytes(
            self.take(2)?
                .try_into()
                .map_err(|_| ProtocolError::Truncated)?,
        ))
    }

    fn i16(&mut self) -> Result<i16, ProtocolError> {
        Ok(i16::from_le_bytes(
            self.take(2)?
                .try_into()
                .map_err(|_| ProtocolError::Truncated)?,
        ))
    }

    fn u32(&mut self) -> Result<u32, ProtocolError> {
        Ok(u32::from_le_bytes(
            self.take(4)?
                .try_into()
                .map_err(|_| ProtocolError::Truncated)?,
        ))
    }

    fn i32(&mut self) -> Result<i32, ProtocolError> {
        Ok(i32::from_le_bytes(
            self.take(4)?
                .try_into()
                .map_err(|_| ProtocolError::Truncated)?,
        ))
    }

    fn u64(&mut self) -> Result<u64, ProtocolError> {
        Ok(u64::from_le_bytes(
            self.take(8)?
                .try_into()
                .map_err(|_| ProtocolError::Truncated)?,
        ))
    }

    fn bytes(&mut self, count: usize) -> Result<&'a [u8], ProtocolError> {
        self.take(count)
    }

    fn version(&mut self) -> Result<(), ProtocolError> {
        let version = self.u16()?;
        if version != ABI_VERSION {
            return Err(ProtocolError::Version(version));
        }
        Ok(())
    }

    fn count(&mut self, name: &'static str, maximum: usize) -> Result<usize, ProtocolError> {
        let count =
            usize::try_from(self.u32()?).map_err(|_| ProtocolError::InvalidValue("count"))?;
        validate_count(name, count, maximum)?;
        Ok(count)
    }

    fn position(&mut self) -> Result<Position, ProtocolError> {
        Ok(Position::new(self.i16()?, self.i16()?))
    }

    fn buff(&mut self) -> Result<Buff, ProtocolError> {
        Ok(Buff {
            kind: self.u32()?,
            remaining: self.i16()?,
            stacks: self.i16()?,
            magnitude: self.i32()?,
            flags: self.u32()?,
        })
    }

    fn event(&mut self) -> Result<Event, ProtocolError> {
        let tag = self.u8()?;
        let kind = EventKind::try_from(tag).map_err(ProtocolError::UnknownTag)?;
        let _flags = self.u8()?;
        let _reserved = self.u16()?;
        Ok(Event {
            kind,
            actor: self.u32()?,
            target: self.u32()?,
            position: self.position()?,
            value: self.i32()?,
            detail: self.u32()?,
        })
    }

    fn finish(self) -> Result<(), ProtocolError> {
        let remaining = self.bytes.len().saturating_sub(self.offset);
        if remaining == 0 {
            Ok(())
        } else {
            Err(ProtocolError::TrailingBytes(remaining))
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::buffs::BUFF_TICK_DAMAGE;

    use super::*;

    #[test]
    fn snapshot_round_trip_is_byte_stable() {
        let snapshot = Snapshot {
            width: 3,
            height: 2,
            turn: 99,
            seed: 123,
            tiles: vec![0, 0, 1, 0, 0, 0],
            entities: vec![Entity {
                id: 8,
                generation: 4,
                position: Position::new(1, 1),
                hp: 5,
                max_hp: 7,
                faction: 2,
                flags: 0,
            }],
            buffs: vec![(
                8,
                Buff {
                    kind: 12,
                    remaining: 4,
                    stacks: 2,
                    magnitude: 3,
                    flags: BUFF_TICK_DAMAGE,
                },
            )],
        };
        let encoded = encode_snapshot(&snapshot).expect("encode");
        let decoded = decode_snapshot(&encoded).expect("decode");
        assert_eq!(decoded, snapshot);
        assert_eq!(encode_snapshot(&decoded).expect("re-encode"), encoded);
    }

    #[test]
    fn commands_round_trip() {
        let batch = CommandBatch {
            expected_turn: 7,
            commands: vec![
                Command::Move {
                    entity: 1,
                    dx: -1,
                    dy: 0,
                },
                Command::Damage {
                    actor: 1,
                    target: 2,
                    amount: 4,
                },
                Command::RunAi { faction: 9 },
            ],
        };
        let bytes = encode_commands(&batch).expect("encode");
        assert_eq!(decode_commands(&bytes).expect("decode"), batch);
    }

    #[test]
    fn grid_path_modes_round_trip_in_reserved_flags() {
        for mode in [
            PathfindingMode::Fast,
            PathfindingMode::Quality,
            PathfindingMode::Human,
        ] {
            let query = Query::GridPath {
                start: Position::new(1, 2),
                goal: Position::new(5, 6),
                max_visited: 100,
                diagonal: true,
                mode,
            };
            let bytes = encode_query(query);
            assert_eq!(decode_query(&bytes).expect("decode"), query);
        }
    }

    #[test]
    fn rejects_trailing_and_wrong_version() {
        let mut bytes = encode_query(Query::Nearby {
            origin: Position::new(0, 0),
            radius: 2,
        });
        bytes.push(1);
        assert!(matches!(
            decode_query(&bytes),
            Err(ProtocolError::TrailingBytes(1))
        ));

        let mut version = encode_query(Query::Nearby {
            origin: Position::new(0, 0),
            radius: 2,
        });
        version[4..6].copy_from_slice(&99_u16.to_le_bytes());
        assert_eq!(decode_query(&version), Err(ProtocolError::Version(99)));
    }
}
