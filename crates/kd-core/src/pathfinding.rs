// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Compatibility behavior in this file is adapted from Kinky Dungeon 5.4.92.

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

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
#[repr(u8)]
pub enum PathfindingMode {
    Quality = 1,
    #[default]
    Fast = 0,
    Human = 2,
}

impl PathfindingMode {
    #[must_use]
    pub const fn query_flags(self) -> u8 {
        (self as u8) << 1
    }

    #[must_use]
    pub const fn from_query_flags(flags: u8) -> Option<Self> {
        match (flags >> 1) & 0b11 {
            0 => Some(Self::Fast),
            1 => Some(Self::Quality),
            2 => Some(Self::Human),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug)]
struct SearchNode {
    state: usize,
    f_score: f64,
    g_score: f64,
    sequence: u32,
}

impl PartialEq for SearchNode {
    fn eq(&self, other: &Self) -> bool {
        self.state == other.state
            && self.f_score.to_bits() == other.f_score.to_bits()
            && self.g_score.to_bits() == other.g_score.to_bits()
            && self.sequence == other.sequence
    }
}

impl Eq for SearchNode {}

impl Ord for SearchNode {
    fn cmp(&self, other: &Self) -> Ordering {
        other
            .f_score
            .total_cmp(&self.f_score)
            .then_with(|| other.g_score.total_cmp(&self.g_score))
            .then_with(|| other.sequence.cmp(&self.sequence))
    }
}

impl PartialOrd for SearchNode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

const NO_PARENT: usize = usize::MAX;
const HUMAN_DIRECTION_NONE: u8 = 8;
const FAST_HEURISTIC_WEIGHT: f64 = 1.35;
const HUMAN_HEURISTIC_WEIGHT: f64 = 1.25;
const HUMAN_TURN_PENALTY: f64 = 0.35;
const MAX_QUALITY_FIELDS: usize = 8;

#[derive(Debug)]
struct QualityField {
    goal_index: usize,
    diagonal: bool,
    distances: Vec<f64>,
    next: Vec<usize>,
    settled: Vec<bool>,
    open: BinaryHeap<SearchNode>,
    sequence: u32,
    last_used: u64,
}

impl QualityField {
    fn new(tile_count: usize, goal_index: usize, diagonal: bool, last_used: u64) -> Self {
        let mut distances = vec![f64::INFINITY; tile_count];
        distances[goal_index] = 0.0;
        let mut open = BinaryHeap::new();
        open.push(SearchNode {
            state: goal_index,
            f_score: 0.0,
            g_score: 0.0,
            sequence: 0,
        });
        Self {
            goal_index,
            diagonal,
            distances,
            next: vec![NO_PARENT; tile_count],
            settled: vec![false; tile_count],
            open,
            sequence: 0,
            last_used,
        }
    }
}

#[derive(Debug, Default)]
pub struct GridPathWorkspace {
    epoch: u32,
    seen: Vec<u32>,
    closed: Vec<u32>,
    g_scores: Vec<f64>,
    parents: Vec<usize>,
    directions: Vec<u8>,
    open: BinaryHeap<SearchNode>,
    sequence: u32,
    quality_fields: Vec<QualityField>,
    quality_clock: u64,
}

impl GridPathWorkspace {
    pub fn clear_persistent(&mut self) {
        self.quality_fields.clear();
        self.open.clear();
    }

    fn begin(&mut self, state_count: usize) {
        self.epoch = self.epoch.wrapping_add(1);
        if self.epoch == 0 {
            self.seen.fill(0);
            self.closed.fill(0);
            self.epoch = 1;
        }
        if self.seen.len() < state_count {
            self.seen.resize(state_count, 0);
            self.closed.resize(state_count, 0);
            self.g_scores.resize(state_count, f64::INFINITY);
            self.parents.resize(state_count, NO_PARENT);
            self.directions.resize(state_count, HUMAN_DIRECTION_NONE);
        }
        self.open.clear();
        self.sequence = 0;
    }

    fn set_score(&mut self, state: usize, score: f64, parent: usize) {
        self.seen[state] = self.epoch;
        self.g_scores[state] = score;
        self.parents[state] = parent;
    }

    fn score(&self, state: usize) -> f64 {
        if self.seen[state] == self.epoch {
            self.g_scores[state]
        } else {
            f64::INFINITY
        }
    }

    fn push(&mut self, state: usize, g_score: f64, f_score: f64) {
        let sequence = self.sequence;
        self.sequence = self.sequence.wrapping_add(1);
        self.open.push(SearchNode {
            state,
            f_score,
            g_score,
            sequence,
        });
    }

    fn quality_field(
        &mut self,
        tile_count: usize,
        goal_index: usize,
        diagonal: bool,
    ) -> &mut QualityField {
        self.quality_clock = self.quality_clock.wrapping_add(1);
        let last_used = self.quality_clock;
        if let Some(index) = self
            .quality_fields
            .iter()
            .position(|field| field.goal_index == goal_index && field.diagonal == diagonal)
        {
            self.quality_fields[index].last_used = last_used;
            return &mut self.quality_fields[index];
        }
        if self.quality_fields.len() >= MAX_QUALITY_FIELDS {
            let index = self
                .quality_fields
                .iter()
                .enumerate()
                .min_by_key(|(_, field)| field.last_used)
                .map_or(0, |(index, _)| index);
            self.quality_fields[index] =
                QualityField::new(tile_count, goal_index, diagonal, last_used);
            return &mut self.quality_fields[index];
        }
        self.quality_fields.push(QualityField::new(
            tile_count, goal_index, diagonal, last_used,
        ));
        self.quality_fields
            .last_mut()
            .expect("quality field was just inserted")
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
/// heuristic, and diagonal turn penalties intentionally follow KD 5.4.92.
#[must_use]
pub fn find_grid_path(
    grid: &Grid,
    start: Position,
    goal: Position,
    max_visited: u32,
    diagonal: bool,
) -> PathResult {
    let mut workspace = GridPathWorkspace::default();
    find_grid_path_with_workspace(
        grid,
        start,
        goal,
        max_visited,
        diagonal,
        PathfindingMode::Fast,
        &mut workspace,
    )
}

#[must_use]
pub fn find_grid_path_with_workspace(
    grid: &Grid,
    start: Position,
    goal: Position,
    max_visited: u32,
    diagonal: bool,
    mode: PathfindingMode,
    workspace: &mut GridPathWorkspace,
) -> PathResult {
    if start == goal {
        return PathResult::Found(vec![start]);
    }
    // KD inserts the source without checking its tile and accepts the target
    // before checking the target tile. Keeping those two exceptions in the
    // search lets the host reuse one immutable map snapshot across queries.
    if grid.index(start).is_none() || grid.index(goal).is_none() {
        return PathResult::Unreachable { visited: 0 };
    }
    let Some(start_index) = grid.index(start) else {
        return PathResult::Unreachable { visited: 0 };
    };
    let Some(goal_index) = grid.index(goal) else {
        return PathResult::Unreachable { visited: 0 };
    };

    match mode {
        PathfindingMode::Quality => quality_grid_path(
            grid,
            start_index,
            goal_index,
            max_visited,
            diagonal,
            workspace,
        ),
        PathfindingMode::Fast | PathfindingMode::Human => forward_grid_path(
            grid,
            start_index,
            goal_index,
            max_visited,
            diagonal,
            mode,
            workspace,
        ),
    }
}

#[allow(clippy::too_many_arguments)]
fn forward_grid_path(
    grid: &Grid,
    start_index: usize,
    goal_index: usize,
    max_visited: u32,
    diagonal: bool,
    mode: PathfindingMode,
    workspace: &mut GridPathWorkspace,
) -> PathResult {
    let human = mode == PathfindingMode::Human;
    workspace.begin(grid.tiles().len());
    let start_state = start_index;
    workspace.set_score(start_state, 0.0, NO_PARENT);
    workspace.directions[start_state] = HUMAN_DIRECTION_NONE;
    let start = grid.position(start_index).expect("validated start");
    let goal = grid.position(goal_index).expect("validated goal");
    let weight = if human {
        HUMAN_HEURISTIC_WEIGHT
    } else {
        FAST_HEURISTIC_WEIGHT
    };
    workspace.push(
        start_state,
        0.0,
        weight * grid_heuristic(start, goal, diagonal),
    );
    let mut visited = 0_u32;

    while let Some(current) = workspace.open.pop() {
        if workspace.score(current.state).total_cmp(&current.g_score) != Ordering::Equal
            || workspace.closed[current.state] == workspace.epoch
        {
            continue;
        }
        if visited >= max_visited {
            return PathResult::BudgetExceeded { visited };
        }
        workspace.closed[current.state] = workspace.epoch;
        visited += 1;
        let current_index = current.state;
        if current_index == goal_index {
            return PathResult::Found(reconstruct_workspace_path(
                grid,
                workspace,
                start_state,
                current.state,
            ));
        }
        let current_position = grid.position(current_index).expect("validated open node");
        let incoming_direction = if human {
            usize::from(workspace.directions[current.state])
        } else {
            usize::from(HUMAN_DIRECTION_NONE)
        };
        for (direction, (dx, dy)) in GRID_NEIGHBORS.into_iter().enumerate() {
            if !diagonal && dx != 0 && dy != 0 {
                continue;
            }
            let Some(neighbor) = current_position.offset(dx, dy) else {
                continue;
            };
            let Some(neighbor_index) = grid.index(neighbor) else {
                continue;
            };
            if neighbor_index != goal_index && !grid.is_walkable(neighbor) {
                continue;
            }
            let neighbor_state = neighbor_index;
            let turn_cost = if human
                && incoming_direction != usize::from(HUMAN_DIRECTION_NONE)
                && incoming_direction != direction
            {
                HUMAN_TURN_PENALTY
            } else {
                0.0
            };
            let tentative =
                current.g_score + tile_step_cost(grid, neighbor_index, goal_index) + turn_cost;
            if tentative >= workspace.score(neighbor_state) {
                continue;
            }
            workspace.set_score(neighbor_state, tentative, current.state);
            workspace.directions[neighbor_state] =
                u8::try_from(direction).expect("grid direction fits in u8");
            let estimate = grid_heuristic(neighbor, goal, diagonal);
            workspace.push(
                neighbor_state,
                tentative,
                weight.mul_add(estimate, tentative),
            );
        }
    }
    PathResult::Unreachable { visited }
}

fn quality_grid_path(
    grid: &Grid,
    start_index: usize,
    goal_index: usize,
    max_visited: u32,
    diagonal: bool,
    workspace: &mut GridPathWorkspace,
) -> PathResult {
    let tile_count = grid.tiles().len();
    let field = workspace.quality_field(tile_count, goal_index, diagonal);
    if field.settled[start_index] {
        return PathResult::Found(reconstruct_quality_path(
            grid,
            field,
            start_index,
            goal_index,
        ));
    }
    let mut visited = 0_u32;
    while let Some(current) = field.open.pop() {
        if field.distances[current.state].total_cmp(&current.g_score) != Ordering::Equal
            || field.settled[current.state]
        {
            continue;
        }
        if visited >= max_visited {
            field.open.push(current);
            return PathResult::BudgetExceeded { visited };
        }
        field.settled[current.state] = true;
        visited += 1;
        let is_source = current.state == start_index;
        let source_is_blocked =
            is_source && !grid.is_walkable(grid.position(start_index).expect("validated source"));
        if !source_is_blocked {
            let current_position = grid.position(current.state).expect("validated field node");
            let step_cost = tile_step_cost(grid, current.state, goal_index);
            for (dx, dy) in GRID_NEIGHBORS {
                if !diagonal && dx != 0 && dy != 0 {
                    continue;
                }
                let Some(predecessor) = current_position.offset(dx, dy) else {
                    continue;
                };
                let Some(predecessor_index) = grid.index(predecessor) else {
                    continue;
                };
                if predecessor_index != start_index && !grid.is_walkable(predecessor) {
                    continue;
                }
                let tentative = current.g_score + step_cost;
                if tentative >= field.distances[predecessor_index] {
                    continue;
                }
                field.distances[predecessor_index] = tentative;
                field.next[predecessor_index] = current.state;
                field.sequence = field.sequence.wrapping_add(1);
                field.open.push(SearchNode {
                    state: predecessor_index,
                    f_score: tentative,
                    g_score: tentative,
                    sequence: field.sequence,
                });
            }
        }
        if is_source {
            return PathResult::Found(reconstruct_quality_path(
                grid,
                field,
                start_index,
                goal_index,
            ));
        }
    }
    PathResult::Unreachable { visited }
}

fn tile_step_cost(grid: &Grid, index: usize, goal_index: usize) -> f64 {
    if index == goal_index {
        1.0
    } else {
        1.0 + f64::from(grid.tiles()[index] >> 1) / 4.0
    }
}

fn grid_heuristic(position: Position, goal: Position, diagonal: bool) -> f64 {
    let dx = u32::from(position.x.abs_diff(goal.x));
    let dy = u32::from(position.y.abs_diff(goal.y));
    f64::from(if diagonal {
        dx.max(dy)
    } else {
        dx.saturating_add(dy)
    })
}

fn reconstruct_workspace_path(
    grid: &Grid,
    workspace: &GridPathWorkspace,
    start_state: usize,
    mut current_state: usize,
) -> Vec<Position> {
    let mut reversed = Vec::new();
    loop {
        reversed.push(grid.position(current_state).expect("validated path state"));
        if current_state == start_state {
            break;
        }
        current_state = workspace.parents[current_state];
        debug_assert_ne!(current_state, NO_PARENT);
    }
    reversed.reverse();
    reversed
}

fn reconstruct_quality_path(
    grid: &Grid,
    field: &QualityField,
    start_index: usize,
    goal_index: usize,
) -> Vec<Position> {
    let mut path = Vec::new();
    let mut current = start_index;
    for _ in 0..=grid.tiles().len() {
        path.push(grid.position(current).expect("validated quality path"));
        if current == goal_index {
            return path;
        }
        current = field.next[current];
        debug_assert_ne!(current, NO_PARENT);
    }
    unreachable!("quality path contains a cycle")
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

    use super::{
        GridPathWorkspace, PathResult, PathfindingMode, find_grid_path,
        find_grid_path_with_workspace, find_path,
    };

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

    #[test]
    fn weighted_grid_path_accepts_blocked_source_and_target() {
        let mut grid = Grid::new(5, 3).expect("grid");
        grid.set_blocked(Position::new(0, 1), true)
            .expect("blocked source");
        grid.set_blocked(Position::new(4, 1), true)
            .expect("blocked target");

        let PathResult::Found(path) =
            find_grid_path(&grid, Position::new(0, 1), Position::new(4, 1), 100, true)
        else {
            panic!("expected a path");
        };
        assert_eq!(path.first(), Some(&Position::new(0, 1)));
        assert_eq!(path.last(), Some(&Position::new(4, 1)));
    }

    #[test]
    fn quality_mode_finds_the_lowest_weight_route_and_reuses_its_field() {
        let mut tiles = vec![0; 7 * 5];
        for x in 2..5 {
            tiles[x + 2 * 7] = 40 << 1;
        }
        let grid = Grid::from_tiles(7, 5, tiles).expect("weighted grid");
        let mut workspace = GridPathWorkspace::default();
        let PathResult::Found(path) = find_grid_path_with_workspace(
            &grid,
            Position::new(1, 2),
            Position::new(5, 2),
            100,
            false,
            PathfindingMode::Quality,
            &mut workspace,
        ) else {
            panic!("expected quality path");
        };
        assert!(
            path.iter()
                .all(|position| position.y != 2 || position.x < 2 || position.x > 4)
        );

        // The first reverse destination search settled this nearer source, so
        // the same goal can be answered without any new node visits.
        assert!(matches!(
            find_grid_path_with_workspace(
                &grid,
                Position::new(4, 2),
                Position::new(5, 2),
                0,
                false,
                PathfindingMode::Quality,
                &mut workspace,
            ),
            PathResult::Found(_)
        ));
    }

    #[test]
    fn fast_mode_stays_within_its_documented_quality_bound() {
        let mut tiles = vec![0; 9 * 7];
        for y in 1..6 {
            tiles[4 + y * 9] = if y == 5 { 0 } else { 24 << 1 };
        }
        let grid = Grid::from_tiles(9, 7, tiles).expect("weighted grid");
        let mut workspace = GridPathWorkspace::default();
        let PathResult::Found(quality) = find_grid_path_with_workspace(
            &grid,
            Position::new(1, 1),
            Position::new(7, 1),
            1_000,
            true,
            PathfindingMode::Quality,
            &mut workspace,
        ) else {
            panic!("expected quality path");
        };
        let PathResult::Found(fast) = find_grid_path_with_workspace(
            &grid,
            Position::new(1, 1),
            Position::new(7, 1),
            1_000,
            true,
            PathfindingMode::Fast,
            &mut workspace,
        ) else {
            panic!("expected fast path");
        };
        assert!(path_cost(&grid, &fast) <= path_cost(&grid, &quality) * 1.35);
    }

    #[test]
    fn human_mode_prefers_a_stable_heading_on_open_ground() {
        let grid = Grid::new(10, 7).expect("grid");
        let mut workspace = GridPathWorkspace::default();
        let PathResult::Found(path) = find_grid_path_with_workspace(
            &grid,
            Position::new(1, 1),
            Position::new(8, 5),
            1_000,
            true,
            PathfindingMode::Human,
            &mut workspace,
        ) else {
            panic!("expected human path");
        };
        let directions: Vec<_> = path
            .windows(2)
            .map(|step| {
                (
                    step[1].x.saturating_sub(step[0].x),
                    step[1].y.saturating_sub(step[0].y),
                )
            })
            .collect();
        assert!(
            directions
                .windows(2)
                .filter(|pair| pair[0] != pair[1])
                .count()
                <= 1
        );
    }

    fn path_cost(grid: &Grid, path: &[Position]) -> f64 {
        path.iter()
            .skip(1)
            .map(|position| {
                let index = grid.index(*position).expect("path tile");
                1.0 + f64::from(grid.tiles()[index] >> 1) / 4.0
            })
            .sum()
    }
}
