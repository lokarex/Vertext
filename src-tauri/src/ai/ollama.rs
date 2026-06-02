use crate::ai::{prompt, AiConfig, LlmProvider};
use async_trait::async_trait;
use std::time::Duration;

pub struct OllamaProvider;

#[async_trait]
impl LlmProvider for OllamaProvider {
    async fn generate_commit_message(
        &self,
        diff: &str,
        config: &AiConfig,
    ) -> Result<String, String> {
        let endpoint = config
            .endpoint
            .as_deref()
            .unwrap_or("http://localhost:11434");
        let url = format!("{}/api/chat", endpoint.trim_end_matches('/'));

        let system_prompt = prompt::build_system_prompt();
        let body = serde_json::json!({
            "model": config.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": diff}
            ],
            "stream": false,
        });

        let client = reqwest::Client::new();
        let resp = client
            .post(&url)
            .json(&body)
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    "ai.error.timeout".to_string()
                } else if e.is_connect() {
                    "ai.error.ollamaNotRunning".to_string()
                } else {
                    format!("Request failed: {}", e)
                }
            })?;

        if !resp.status().is_success() {
            return Err("ai.error.serviceError".to_string());
        }

        let resp_body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        resp_body
            .get("message")
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| "ai.error.serviceError".to_string())
    }
}
