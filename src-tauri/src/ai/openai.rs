use crate::ai::{prompt, AiConfig, AiProviderType, LlmProvider};
use async_trait::async_trait;
use std::time::Duration;

pub struct OpenAiProvider;

#[async_trait]
impl LlmProvider for OpenAiProvider {
    async fn generate_commit_message(
        &self,
        diff: &str,
        config: &AiConfig,
    ) -> Result<String, String> {
        let endpoint = match config.provider {
            AiProviderType::DeepSeek => "https://api.deepseek.com/v1/chat/completions".to_string(),
            _ => "https://api.openai.com/v1/chat/completions".to_string(),
        };

        let system_prompt = prompt::build_system_prompt();
        let body = serde_json::json!({
            "model": config.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": diff}
            ],
            "temperature": 0.3,
        });

        let client = reqwest::Client::new();
        let resp = client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {}", config.api_key))
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
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|msg| msg.get("content"))
            .and_then(|c| c.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| "ai.error.serviceError".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openai_provider_has_correct_config() {
        let config = AiConfig {
            provider: AiProviderType::OpenAI,
            model: "gpt-4o-mini".to_string(),
            api_key: "test-key".to_string(),
            endpoint: None,
        };
        assert_eq!(config.provider, AiProviderType::OpenAI);
        assert_eq!(config.model, "gpt-4o-mini");
    }

    #[test]
    fn deepseek_provider_uses_correct_type() {
        let config = AiConfig {
            provider: AiProviderType::DeepSeek,
            model: "deepseek-chat".to_string(),
            api_key: "test-key".to_string(),
            endpoint: None,
        };
        assert_eq!(config.provider, AiProviderType::DeepSeek);
    }
}
