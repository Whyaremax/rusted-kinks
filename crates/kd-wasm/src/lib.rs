use kd_core::{ABI_VERSION, Engine};
use wasm_bindgen::prelude::*;

/// One long-lived engine instance. All hot operations cross the boundary as a
/// single validated byte buffer.
#[wasm_bindgen]
#[derive(Debug)]
pub struct HybridEngine {
    inner: Engine,
    last_error: Option<String>,
}

#[wasm_bindgen]
impl HybridEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u16, height: u16, seed: u64) -> Result<Self, JsError> {
        let inner = Engine::new(width, height, seed).map_err(|error| to_js_error(&error))?;
        Ok(Self {
            inner,
            last_error: None,
        })
    }

    #[must_use]
    #[wasm_bindgen(js_name = abiVersion)]
    pub fn abi_version() -> u16 {
        ABI_VERSION
    }

    #[must_use]
    #[wasm_bindgen(js_name = currentTurn)]
    pub fn current_turn(&self) -> u64 {
        self.inner.world().turn
    }

    #[wasm_bindgen(js_name = loadSnapshot)]
    pub fn load_snapshot(&mut self, bytes: &[u8]) -> Result<(), JsError> {
        self.run_unit(|engine| engine.load_snapshot_bytes(bytes))
    }

    #[wasm_bindgen(js_name = saveSnapshot)]
    pub fn save_snapshot(&mut self) -> Result<Vec<u8>, JsError> {
        match self.inner.snapshot_bytes() {
            Ok(bytes) => {
                self.last_error = None;
                Ok(bytes)
            }
            Err(error) => {
                let message = error.to_string();
                self.last_error = Some(message.clone());
                Err(JsError::new(&message))
            }
        }
    }

    pub fn step(&mut self, bytes: &[u8]) -> Result<Vec<u8>, JsError> {
        match self.inner.step_bytes(bytes) {
            Ok(response) => {
                self.last_error = None;
                Ok(response)
            }
            Err(error) => {
                let message = error.to_string();
                self.last_error = Some(message.clone());
                Err(JsError::new(&message))
            }
        }
    }

    pub fn query(&mut self, bytes: &[u8]) -> Result<Vec<u8>, JsError> {
        match self.inner.query_bytes(bytes) {
            Ok(response) => {
                self.last_error = None;
                Ok(response)
            }
            Err(error) => {
                let message = error.to_string();
                self.last_error = Some(message.clone());
                Err(JsError::new(&message))
            }
        }
    }

    #[must_use]
    #[wasm_bindgen(js_name = lastError)]
    pub fn last_error(&self) -> Option<String> {
        self.last_error.clone()
    }
}

impl HybridEngine {
    fn run_unit(
        &mut self,
        operation: impl FnOnce(&mut Engine) -> Result<(), kd_core::EngineError>,
    ) -> Result<(), JsError> {
        match operation(&mut self.inner) {
            Ok(()) => {
                self.last_error = None;
                Ok(())
            }
            Err(error) => {
                let message = error.to_string();
                self.last_error = Some(message.clone());
                Err(JsError::new(&message))
            }
        }
    }
}

fn to_js_error(error: &kd_core::EngineError) -> JsError {
    JsError::new(&error.to_string())
}

#[wasm_bindgen]
#[must_use]
pub fn kd_hybrid_abi_version() -> u16 {
    ABI_VERSION
}
