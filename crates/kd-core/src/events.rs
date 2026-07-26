use std::collections::VecDeque;

use crate::model::{EntityId, Position};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum EventKind {
    TurnStarted = 1,
    Moved = 2,
    Damaged = 3,
    Healed = 4,
    Died = 5,
    BuffAdded = 6,
    BuffTicked = 7,
    Waited = 8,
    Blocked = 9,
    TurnEnded = 10,
}

impl TryFrom<u8> for EventKind {
    type Error = u8;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::TurnStarted),
            2 => Ok(Self::Moved),
            3 => Ok(Self::Damaged),
            4 => Ok(Self::Healed),
            5 => Ok(Self::Died),
            6 => Ok(Self::BuffAdded),
            7 => Ok(Self::BuffTicked),
            8 => Ok(Self::Waited),
            9 => Ok(Self::Blocked),
            10 => Ok(Self::TurnEnded),
            other => Err(other),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Event {
    pub kind: EventKind,
    pub actor: EntityId,
    pub target: EntityId,
    pub position: Position,
    pub value: i32,
    pub detail: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventQueue {
    events: VecDeque<Event>,
    capacity: usize,
    dropped: u32,
}

impl EventQueue {
    #[must_use]
    pub fn new(capacity: usize) -> Self {
        Self {
            events: VecDeque::with_capacity(capacity.min(65_536)),
            capacity: capacity.clamp(1, 65_536),
            dropped: 0,
        }
    }

    pub fn push(&mut self, event: Event) {
        if self.events.len() == self.capacity {
            self.events.pop_front();
            self.dropped = self.dropped.saturating_add(1);
        }
        self.events.push_back(event);
    }

    #[must_use]
    pub fn drain(&mut self) -> Vec<Event> {
        self.events.drain(..).collect()
    }

    #[must_use]
    pub const fn dropped(&self) -> u32 {
        self.dropped
    }
}

#[cfg(test)]
mod tests {
    use crate::model::Position;

    use super::{Event, EventKind, EventQueue};

    fn event(value: i32) -> Event {
        Event {
            kind: EventKind::Waited,
            actor: 1,
            target: 0,
            position: Position::new(0, 0),
            value,
            detail: 0,
        }
    }

    #[test]
    fn bounded_queue_drops_oldest() {
        let mut queue = EventQueue::new(2);
        queue.push(event(1));
        queue.push(event(2));
        queue.push(event(3));
        assert_eq!(queue.dropped(), 1);
        assert_eq!(queue.drain(), vec![event(2), event(3)]);
    }
}
