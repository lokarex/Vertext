pub fn build_system_prompt() -> String {
    concat!(
        "You are a commit message generator for a Git-based note-taking app.\n",
        "Given a git diff, generate a concise, meaningful commit message.\n",
        "\n",
        "Rules:\n",
        "1. First line: conventional commit format (<type>: <summary>)\n",
        "   Types: feat, fix, docs, style, refactor, chore\n",
        "2. Keep the first line under 72 characters.\n",
        "3. Optionally add a blank line followed by 1-3 bullet points\n",
        "   summarizing key changes, only if the diff is substantial.\n",
        "4. Be specific about what changed, not generic.\n",
        "5. Use English only.\n",
        "\n",
        "Output format:\n",
        "<type>: <summary>\n",
        "\n",
        "- <bullet point 1>\n",
        "- <bullet point 2>\n",
    )
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompt_is_non_empty() {
        let prompt = build_system_prompt();
        assert!(!prompt.is_empty());
    }

    #[test]
    fn prompt_contains_required_keywords() {
        let prompt = build_system_prompt();
        assert!(prompt.contains("conventional commit"));
        assert!(prompt.contains("feat"));
        assert!(prompt.contains("English only"));
    }
}
