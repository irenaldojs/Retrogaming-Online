use serde::{Deserialize, Serialize};
use std::sync::LazyLock;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConfig {
    pub tick_rate_hz: u64,
    pub width: f32,
    pub height: f32,
    pub paddle_height: f32,
    pub paddle_width: f32,
    pub p1_x: f32,
    pub p2_x: f32,
    pub ball_size: f32,
    pub initial_speed_x: f32,
    pub initial_speed_y: f32,
    pub max_ball_speed: f32,
    pub paddle_speed: f32,
    pub paddle_spin: f32,
    pub bounce_angle: f32,
    pub speed_increase: f32,
    pub reset_speed_y_min: f32,
    pub reset_speed_y_max: f32,
}

pub static CONFIG: LazyLock<GameConfig> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../game-config.json"))
        .expect("game-config.json must contain valid game constants")
});

pub fn is_valid_direction(dir: f32) -> bool {
    dir.is_finite() && [-1.0, 0.0, 1.0].contains(&dir)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GameState {
    pub p1_y: f32,
    pub p2_y: f32,
    pub ball_x: f32,
    pub ball_y: f32,
    pub ball_vx: f32,
    pub ball_vy: f32,
    pub score_p1: u32,
    pub score_p2: u32,
    #[serde(rename = "rallyCount")]
    pub rally_count: u32,
    #[serde(rename = "maxScore")]
    pub max_score: u32,
    pub status: String,
    pub countdown: Option<u32>,
    pub winner: Option<String>,
    #[serde(rename = "lastHitBy")]
    pub last_hit_by: Option<String>,
}

impl GameState {
    pub fn new(max_score: u32) -> Self {
        Self {
            p1_y: (CONFIG.height - CONFIG.paddle_height) / 2.0,
            p2_y: (CONFIG.height - CONFIG.paddle_height) / 2.0,
            ball_x: CONFIG.width / 2.0,
            ball_y: CONFIG.height / 2.0,
            ball_vx: CONFIG.initial_speed_x,
            ball_vy: CONFIG.initial_speed_y,
            score_p1: 0,
            score_p2: 0,
            rally_count: 0,
            max_score,
            status: "waiting".to_string(),
            countdown: None,
            winner: None,
            last_hit_by: None,
        }
    }

    pub fn update(&mut self, p1_input: f32, p2_input: f32) {
        if self.status != "playing" {
            return;
        }

        let max_paddle_y = CONFIG.height - CONFIG.paddle_height;
        self.p1_y = (self.p1_y + p1_input * CONFIG.paddle_speed).clamp(0.0, max_paddle_y);
        self.p2_y = (self.p2_y + p2_input * CONFIG.paddle_speed).clamp(0.0, max_paddle_y);
        self.ball_x += self.ball_vx;
        self.ball_y += self.ball_vy;

        if self.ball_y <= 0.0 {
            self.ball_y = 0.0;
            self.ball_vy = self.ball_vy.abs();
        } else if self.ball_y >= CONFIG.height - CONFIG.ball_size {
            self.ball_y = CONFIG.height - CONFIG.ball_size;
            self.ball_vy = -self.ball_vy.abs();
        }

        let ball_radius = CONFIG.ball_size / 2.0;
        let p1_right = CONFIG.p1_x + CONFIG.paddle_width;
        if self.ball_vx < 0.0
            && self.ball_x <= p1_right
            && self.ball_x + CONFIG.ball_size >= CONFIG.p1_x
            && self.ball_y + CONFIG.ball_size >= self.p1_y
            && self.ball_y <= self.p1_y + CONFIG.paddle_height
        {
            let center = self.p1_y + CONFIG.paddle_height / 2.0;
            let offset = ((self.ball_y + ball_radius - center) / (CONFIG.paddle_height / 2.0))
                .clamp(-1.0, 1.0);
            self.ball_vx = (self.ball_vx.abs() * CONFIG.speed_increase).min(CONFIG.max_ball_speed);
            self.ball_vy = offset * CONFIG.bounce_angle + p1_input * CONFIG.paddle_spin;
            self.ball_x = p1_right;
            self.last_hit_by = Some("p1".to_string());
            self.rally_count += 1;
        }

        if self.ball_vx > 0.0
            && self.ball_x + CONFIG.ball_size >= CONFIG.p2_x
            && self.ball_x <= CONFIG.p2_x + CONFIG.paddle_width
            && self.ball_y + CONFIG.ball_size >= self.p2_y
            && self.ball_y <= self.p2_y + CONFIG.paddle_height
        {
            let center = self.p2_y + CONFIG.paddle_height / 2.0;
            let offset = ((self.ball_y + ball_radius - center) / (CONFIG.paddle_height / 2.0))
                .clamp(-1.0, 1.0);
            self.ball_vx = -(self.ball_vx.abs() * CONFIG.speed_increase).min(CONFIG.max_ball_speed);
            self.ball_vy = offset * CONFIG.bounce_angle + p2_input * CONFIG.paddle_spin;
            self.ball_x = CONFIG.p2_x - CONFIG.ball_size;
            self.last_hit_by = Some("p2".to_string());
            self.rally_count += 1;
        }

        if self.ball_x < 0.0 {
            self.score_p2 += 1;
            if self.score_p2 >= self.max_score {
                self.finish("p2");
            } else {
                self.reset_ball(true);
            }
        } else if self.ball_x > CONFIG.width {
            self.score_p1 += 1;
            if self.score_p1 >= self.max_score {
                self.finish("p1");
            } else {
                self.reset_ball(false);
            }
        }
    }

    pub fn reset_match(&mut self) {
        let max_score = self.max_score;
        *self = Self::new(max_score);
    }

    fn finish(&mut self, winner: &str) {
        self.status = "finished".to_string();
        self.winner = Some(winner.to_string());
    }

    fn reset_ball(&mut self, serve_left: bool) {
        self.ball_x = CONFIG.width / 2.0;
        self.ball_y = CONFIG.height / 2.0;
        self.ball_vx = if serve_left {
            -CONFIG.initial_speed_x
        } else {
            CONFIG.initial_speed_x
        };
        let range = CONFIG.reset_speed_y_max - CONFIG.reset_speed_y_min;
        self.ball_vy = CONFIG.reset_speed_y_min + range * 0.5;
        self.rally_count = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::{is_valid_direction, GameState, CONFIG};

    #[test]
    fn input_direction_is_restricted_to_valid_values() {
        assert!(is_valid_direction(-1.0));
        assert!(is_valid_direction(0.0));
        assert!(is_valid_direction(1.0));
        assert!(!is_valid_direction(2.0));
        assert!(!is_valid_direction(f32::NAN));
    }

    #[test]
    fn new_game_waits_for_players() {
        assert_eq!(GameState::new(5).status, "waiting");
    }

    #[test]
    fn waiting_game_does_not_advance() {
        let mut game = GameState::new(5);
        let initial_ball_x = game.ball_x;
        game.update(1.0, -1.0);
        assert_eq!(game.ball_x, initial_ball_x);
        assert_eq!(game.p1_y, (CONFIG.height - CONFIG.paddle_height) / 2.0);
    }

    #[test]
    fn paddle_input_is_applied_and_clamped() {
        let mut game = GameState::new(5);
        game.status = "playing".to_string();
        game.p1_y = 0.0;
        game.p2_y = CONFIG.height - CONFIG.paddle_height;
        game.update(-1.0, 1.0);
        assert_eq!(game.p1_y, 0.0);
        assert_eq!(game.p2_y, CONFIG.height - CONFIG.paddle_height);
    }

    #[test]
    fn scoring_resets_ball_and_finishes_at_max_score() {
        let mut game = GameState::new(1);
        game.status = "playing".to_string();
        game.ball_x = CONFIG.width + 1.0;
        game.update(0.0, 0.0);
        assert_eq!(game.score_p1, 1);
        assert_eq!(game.status, "finished");
        assert_eq!(game.winner.as_deref(), Some("p1"));
    }

    #[test]
    fn paddle_hit_reverses_ball_and_tracks_rally() {
        let mut game = GameState::new(5);
        game.status = "playing".to_string();
        game.ball_x = CONFIG.p1_x + CONFIG.paddle_width;
        game.ball_y = game.p1_y + CONFIG.paddle_height / 2.0 - CONFIG.ball_size / 2.0;
        game.ball_vx = -CONFIG.initial_speed_x;
        game.ball_vy = 0.0;
        game.update(0.0, 0.0);
        assert!(game.ball_vx > 0.0);
        assert_eq!(game.rally_count, 1);
        assert_eq!(game.last_hit_by.as_deref(), Some("p1"));
    }
}
