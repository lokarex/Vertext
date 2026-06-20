pub mod anthropic;
pub mod diff;
pub mod ollama;
pub mod openai;
pub mod prompt;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AiProviderType {
    #[serde(rename = "openai")]
    OpenAI,
    #[serde(rename = "anthropic")]
    Anthropic,
    #[serde(rename = "deepseek")]
    DeepSeek,
    #[serde(rename = "ollama")]
    Ollama,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum OutputLanguage {
    #[serde(rename = "en")]
    English,
    #[serde(rename = "zh-CN")]
    SimplifiedChinese,
}

#[derive(Debug, Clone)]
pub struct AiConfig {
    pub provider: AiProviderType,
    pub model: String,
    pub api_key: String,
    pub endpoint: Option<String>,
    pub language: OutputLanguage,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeSummary {
    pub path: String,
    pub status: String,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommitSuggestion {
    pub message: String,
    pub files_changed: Vec<FileChangeSummary>,
}

#[async_trait]
pub trait LlmProvider: Send + Sync {
    async fn generate_commit_message(
        &self,
        diff: &str,
        config: &AiConfig,
    ) -> Result<String, String>;
}

pub fn create_provider(provider_type: &AiProviderType) -> Box<dyn LlmProvider> {
    match provider_type {
        AiProviderType::OpenAI | AiProviderType::DeepSeek => Box::new(openai::OpenAiProvider),
        AiProviderType::Anthropic => Box::new(anthropic::AnthropicProvider),
        AiProviderType::Ollama => Box::new(ollama::OllamaProvider),
    }
}
