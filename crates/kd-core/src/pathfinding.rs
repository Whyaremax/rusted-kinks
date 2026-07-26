// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Compatibility behavior in this file is adapted from Kinky Dungeon 5.1.12.

use std::cmp::Ordering;
use std::collections::BinaryHeap;

use crate::model::{Grid, Position};

// Matches the upstream x-outer/y-inner neighbor order.
const GRID_NEIGHBORS: [(i16, i16); 8] = [
    (-1, -1),
    (-1, 0),
    (-1, 1),
    (0, -1),
    (0, 1),
    (1, -1),
    (1, 0),
    (1, 1),
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct OpenNode {
    position: Position,
    f_score: u32,
    g_score: u32,
    sequence: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct KdOpenNode {
    position: Position,
    f_score: f64,
    g_score: f64,
    parent: Option<usize>,
}

impl Ord for OpenNode {
    fn cmp(&self, other: &Self) -> Ordering {
        // Reverse ordering turns BinaryHeap into a deterministic min-heap.
        other
            .f_score
            .cmp(&self.f_score)
            .then_with(|| other.g_score.cmp(&self.g_score))
            .then_with(|| other.sequence.cmp(&self.sequence))
    }
}

impl PartialOrd for OpenNode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PathResult {
    Found(Vec<Position>),
    Unreachable { visited: u32 },
    BudgetExceeded { visited: u32 },
}

/// Deterministic four-way A* with an explicit work budget.
#[must_use]
pub fn find_path(
    grid: &Grid,
    start: Position,
    goal: Position,
    max_visited: u32,
    is_extra_blocked: impl Fn(Position) -> bool,
) -> PathResult {
    if start == goal {
        return PathResult::Found(vec![start]);
    }
    if !grid.is_walkable(start) || !grid.is_walkable(goal) {
        return PathResult::Unreachable { visited: 0 };
    }

    let len = grid.tiles().len();
    let Some(start_index) = grid.index(start) else {
        return PathResult::Unreachable { visited: 0 };
    };
    let Some(goal_index) = grid.index(goal) else {
        return PathResult::Unreachable { visited: 0 };
    };

    let mut open = BinaryHeap::new();
    let mut g_scores = vec![u32::MAX; len];
    let mut came_from = vec![None; len];
    let mut closed = vec![false; len];
    let mut sequence = 0_u32;
    let mut visited = 0_u32;

    g_scores[start_index] = 0;
    open.push(OpenNode {
        position: start,
        f_score: start.manhattan(goal),
        g_score: 0,
        sequence,
    });

    while let Some(current) = open.pop() {
        let Some(current_index) = grid.index(current.position) else {
            continue;
        };
        if closed[current_index] || current.g_score != g_scores[current_index] {
            continue;
        }
        if visited >= max_visited {
            return PathResult::BudgetExceeded { visited };
        }
        visited += 1;
        if current_index == goal_index {
            return PathResult::Found(reconstruct_path(grid, &came_from, start_index, goal_index));
        }
        closed[current_index] = true;

        // Fixed order makes equal-cost paths repeatable across targets.
        for (dx, dy) in [(0, -1), (-1, 0), (1, 0), (0, 1)] {
            let Some(neighbor) = current.position.offset(dx, dy) else {
                continue;
            };
            let Some(neighbor_index) = grid.index(neighbor) else {
                continue;
            };
            if closed[neighbor_index]
                || !grid.is_walkable(neighbor)
                || (neighbor != goal && is_extra_blocked(neighbor))
            {
                continue;
            }

            let tentative = current.g_score.saturating_add(1);
            if tentative < g_scores[neighbor_index] {
                came_from[neighbor_index] = Some(current_index);
                g_scores[neighbor_index] = tentative;
                sequence = sequence.wrapping_add(1);
                open.push(OpenNode {
                    position: neighbor,
                    g_score: tentative,
                    f_score: tentative.saturating_add(neighbor.manhattan(goal)),
                    sequence,
                });
            }
        }
    }

    PathResult::Unreachable { visited }
}

/// Finds a four- or eight-way path using compact per-tile weights.
///
/// Bit zero in each grid tile remains the blocked flag. Bits one through seven
/// are an additional movement cost in quarter-step units. The returned path
/// includes both start and goal; host adapters may omit the start to match an
/// upstream API. Open-set insertion order, goal handling, the default
/// heuristic, and diagonal turn penalties intentionally follow KD 5.1.12.
#[must_use]
// Keeping the audited upstream control-flow correspondence in one function is
// more valuable here than splitting the search loop across opaque helpers.
#[allow(clippy::too_many_lines)]
pub fn find_grid_path(
    grid: &Grid,
    start: Position,
    goal: Position,
    max_visited: u32,
    diagonal: bool,
) -> PathResult {
    if start == goal {
        return PathResult::Found(vec![start]);
    }
    if !grid.is_walkable(start) || !grid.is_walkable(goal) {
        return PathResult::Unreachable { visited: 0 };
    }
    let len = grid.tiles().len();
    let Some(start_index) = grid.index(start) else {
        return PathResult::Unreachable { visited: 0 };
    };
    if grid.index(goal).is_none() {
        return PathResult::Unreachable { visited: 0 };
    }

    // JS Map keeps the first insertion order when an existing key is updated.
    // A sparse vector plus a cell-to-slot table reproduces that behavior while
    // avoiding string keys and allocations in the search loop.
    let start_node = KdOpenNode {
        position: start,
        f_score: 0.0,
        g_score: 0.0,
        parent: None,
    };
    let mut open = vec![Some(start_node)];
    let mut open_slot = vec![None; len];
    open_slot[start_index] = Some(0);
    let mut open_count = 1_usize;
    let mut closed = vec![None; len];
    let mut visited = 0_u32;

    while open_count > 0 {
        if visited >= max_visited {
            return PathResult::BudgetExceeded { visited };
        }
        let mut lowest = None;
        let mut lowest_old = None;
        let mut lowest_slot = None;
        let mut lowest_cost = 1_000_000_000.0;
        for (slot, candidate) in open.iter().enumerate() {
            let Some(candidate) = *candidate else {
                continue;
            };
            if candidate.f_score < lowest_cost {
                lowest_cost = candidate.f_score;
                lowest_old = lowest;
                lowest = Some(candidate);
                lowest_slot = Some(slot);
            }
        }
        let (Some(current), Some(current_slot)) = (lowest, lowest_slot) else {
            return PathResult::Unreachable { visited };
        };
        let Some(current_index) = grid.index(current.position) else {
            return PathResult::Unreachable { visited };
        };
        visited += 1;

        let mut successors = Vec::with_capacity(GRID_NEIGHBORS.len());
        for (dx, dy) in GRID_NEIGHBORS {
            if !diagonal && dx != 0 && dy != 0 {
                continue;
            }
            let Some(neighbor) = current.position.offset(dx, dy) else {
                continue;
            };
            let Some(neighbor_index) = grid.index(neighbor) else {
                continue;
            };

            // KD accepts the target before checking its underlying tile and
            // returns as soon as it is encountered in neighbor order.
            if neighbor == goal {
                closed[current_index] = Some(current);
                let mut path = reconstruct_kd_path(grid, &closed, start_index, current_index);
                path.push(goal);
                return PathResult::Found(path);
            }
            if !grid.is_walkable(neighbor) {
                continue;
            }

            let mut cost_bonus = f64::from(grid.tiles()[neighbor_index] >> 1) / 4.0;
            if dx != 0 && dy != 0 {
                if let Some(previous_record) = lowest_old {
                    let previous_direction = (
                        current.position.x - previous_record.position.x,
                        current.position.y - previous_record.position.y,
                    );
                    cost_bonus += if previous_direction == (dx, dy) {
                        0.22
                    } else {
                        0.45
                    };
                }
            }
            // Preserve JavaScript's left-to-right Number addition order; tiny
            // rounding differences can change strict f-score tie decisions.
            let g_score = (1.0 + cost_bonus) + current.g_score;
            successors.push((
                neighbor_index,
                KdOpenNode {
                    position: neighbor,
                    g_score,
                    f_score: g_score + kd_heuristic(neighbor, goal),
                    parent: Some(current_index),
                },
            ));
        }

        for (neighbor_index, successor) in successors {
            let open_is_worse = open_slot[neighbor_index].is_none_or(|slot| {
                open[slot].is_some_and(|candidate| candidate.f_score > successor.f_score)
            });
            if !open_is_worse {
                continue;
            }
            let closed_is_worse = closed[neighbor_index]
                .is_none_or(|candidate| candidate.f_score > successor.f_score);
            if !closed_is_worse {
                continue;
            }
            if let Some(slot) = open_slot[neighbor_index] {
                open[slot] = Some(successor);
            } else {
                let slot = open.len();
                open.push(Some(successor));
                open_slot[neighbor_index] = Some(slot);
                open_count += 1;
            }
        }

        open[current_slot] = None;
        open_slot[current_index] = None;
        open_count -= 1;
        closed[current_index] = Some(current);
    }
    PathResult::Unreachable { visited }
}

fn kd_heuristic(position: Position, goal: Position) -> f64 {
    let dx = f64::from(i32::from(position.x) - i32::from(goal.x));
    let dy = f64::from(i32::from(position.y) - i32::from(goal.y));
    let squared_delta = [dx * dx, dy * dy];
    0.1 * (squared_delta[0] + squared_delta[1] - squared_delta[0].min(squared_delta[1]) / 2.0)
}

fn reconstruct_kd_path(
    grid: &Grid,
    closed: &[Option<KdOpenNode>],
    start_index: usize,
    current_index: usize,
) -> Vec<Position> {
    let mut index = current_index;
    let mut reversed = Vec::new();
    loop {
        let node = closed[index].expect("current and parent nodes are closed");
        reversed.push(node.position);
        if index == start_index {
            break;
        }
        let Some(parent) = node.parent else {
            break;
        };
        index = parent;
    }
    reversed.reverse();
    debug_assert_eq!(reversed.first(), grid.position(start_index).as_ref());
    reversed
}

fn reconstruct_path(
    grid: &Grid,
    came_from: &[Option<usize>],
    start_index: usize,
    goal_index: usize,
) -> Vec<Position> {
    let mut current = goal_index;
    let mut reversed = vec![grid.position(current).expect("validated goal index")];
    while current != start_index {
        let Some(previous) = came_from[current] else {
            break;
        };
        current = previous;
        reversed.push(grid.position(current).expect("validated path index"));
    }
    reversed.reverse();
    reversed
}

#[cfg(test)]
mod tests {
    use crate::model::{Grid, Position};

    use super::{PathResult, find_grid_path, find_path};

    #[test]
    fn routes_around_wall() {
        let mut grid = Grid::new(7, 5).expect("grid");
        for y in 0..4 {
            grid.set_blocked(Position::new(3, y), true).expect("wall");
        }
        let result = find_path(&grid, Position::new(1, 1), Position::new(5, 1), 100, |_| {
            false
        });
        let PathResult::Found(path) = result else {
            panic!("expected a path");
        };
        assert_eq!(path.first(), Some(&Position::new(1, 1)));
        assert_eq!(path.last(), Some(&Position::new(5, 1)));
        assert!(path.contains(&Position::new(3, 4)));
    }

    #[test]
    fn respects_work_budget() {
        let grid = Grid::new(30, 30).expect("grid");
        assert!(matches!(
            find_path(&grid, Position::new(0, 0), Position::new(29, 29), 1, |_| {
                false
            }),
            PathResult::BudgetExceeded { .. }
        ));
    }

    #[test]
    fn weighted_grid_path_supports_diagonals() {
        let mut grid = Grid::new(5, 5).expect("grid");
        let expensive = grid.index(Position::new(1, 1)).expect("tile");
        let mut tiles = grid.tiles().to_vec();
        tiles[expensive] = 100 << 1;
        grid = Grid::from_tiles(5, 5, tiles).expect("weighted grid");
        let PathResult::Found(path) =
            find_grid_path(&grid, Position::new(0, 0), Position::new(3, 3), 100, true)
        else {
            panic!("expected grid path");
        };
        assert_eq!(path.first(), Some(&Position::new(0, 0)));
        assert_eq!(path.last(), Some(&Position::new(3, 3)));
        assert!(!path.contains(&Position::new(1, 1)));
    }
}
