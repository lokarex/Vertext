use crate::ai::{prompt, AiConfig, LlmProvider};
use async_trait::async_trait;
use std::time::Duration;

pub struct AnthropicProvider;

#[async_trait]
impl LlmProvider for AnthropicProvider {
    async fn generate_commit_message(
        &self,
        diff: &str,
        config: &AiConfig,
    ) -> Result<String, String> {
        let system_prompt = prompt::build_system_prompt(&config.language);
        let user_prompt = prompt::build_user_prompt(diff);
        let body = serde_json::json!({
            "model": config.model,
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_prompt}
            ],
        });

        let client = reqwest::Client::new();
        let resp = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &config.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    "ai.error.timeout".to_string()
                } else if e.is_connect() {
                    "ai.error.serviceError".to_string()
                } else {
                    format!("Request failed: {}", e)
                }
            })?;

        let status = resp.status();
        let resp_body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        if status == 401 || status == 403 {
            return Err("ai.error.invalidKey".to_string());
        }

        if !status.is_success() {
            let err_msg = resp_body
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or("Unknown error");
            return Err(format!("ai.error.serviceError: {}", err_msg));
        }

        resp_body
            .get("content")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|block| block.get("text"))
            .and_then(|t| t.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| "ai.error.serviceError".to_string())
    }
}
