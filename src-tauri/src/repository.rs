use std::path::Path;

use log::trace;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub oid: String,
    pub full_oid: String,
    pub message: String,
    pub author: String,
    pub time: i64,
    pub branches: Vec<String>,
    pub tags: Vec<String>,
    pub is_head: bool,
}

pub struct Repository {
    inner: git2::Repository,
    remote_url: Option<String>,
    user_name: Option<String>,
    password: Option<String>,
}

impl Repository {
    pub fn open(path: &Path) -> Result<Self, String> {
        let inner = git2::Repository::open(path).map_err(|e| e.to_string())?;
        Ok(Self {
            inner,
            remote_url: None,
            user_name: None,
            password: None,
        })
    }

    pub fn open_with_remote(
        path: &Path,
        remote_url: &str,
        user_name: &str,
        password: &str,
    ) -> Result<Self, String> {
        let mut repo = Self::open(path)?;
        repo.remote_url = Some(remote_url.to_string());
        repo.user_name = Some(user_name.to_string());
        repo.password = Some(password.to_string());
        Ok(repo)
    }

    pub fn ensure_branch(&self, branch_name: &str) -> Result<(), String> {
        let branch_ref = format!("refs/heads/{}", branch_name);
        trace!("Ensuring branch: {}", branch_name);

        match self.inner.find_branch(branch_name, git2::BranchType::Local) {
            Ok(_) => {
                trace!("Branch already exists, switching to it");
                self.inner.set_head(&branch_ref).map_err(|e| e.to_string())?;
            }
            Err(_) => {
                trace!("Branch does not exist, creating it");
                match self.inner.head() {
                    Ok(head_ref) => {
                        if let Some(oid) = head_ref.target() {
                            let commit = self.inner.find_commit(oid).map_err(|e| e.to_string())?;
                            self.inner
                                .branch(branch_name, &commit, false)
                                .map_err(|e| e.to_string())?;
                            self.inner.set_head(&branch_ref).map_err(|e| e.to_string())?;
                            trace!("Created branch '{}' from commit {}", branch_name, oid);
                        } else {
                            trace!("Setting unborn HEAD to branch '{}'", branch_name);
                            self.inner.set_head(&branch_ref).map_err(|e| e.to_string())?;
                        }
                    }
                    Err(_) => {
                        trace!("No HEAD yet, setting unborn HEAD to branch '{}'", branch_name);
                        self.inner.set_head(&branch_ref).map_err(|e| e.to_string())?;
                    }
                }
            }
        }

        self.inner
            .config()
            .map_err(|e| e.to_string())?
            .set_str("user.name", branch_name)
            .map_err(|e| e.to_string())?;
        self.inner
            .config()
            .map_err(|e| e.to_string())?
            .set_str("user.email", &format!("{}@vertext", branch_name))
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn has_uncommitted_changes(&self) -> Result<bool, String> {
        let mut options = git2::StatusOptions::new();
        options.include_untracked(true);
        options.include_ignored(false);
        let statuses = self.inner.statuses(Some(&mut options)).map_err(|e| e.to_string())?;
        Ok(!statuses.is_empty())
    }

    pub fn commit_all(&self) -> Result<(), String> {
        trace!("Committing all changes...");
        let mut index = self.inner.index().map_err(|e| e.to_string())?;
        index
            .add_all(["*"], git2::IndexAddOption::DEFAULT, None)
            .map_err(|e| e.to_string())?;
        index.write().map_err(|e| e.to_string())?;

        let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
        let tree = self.inner.find_tree(tree_oid).map_err(|e| e.to_string())?;

        let sig = self.inner.signature().map_err(|e| e.to_string())?;

        match self.inner.head() {
            Ok(head_ref) => match head_ref.target() {
                Some(parent_oid) => {
                    let parent = self.inner.find_commit(parent_oid).map_err(|e| e.to_string())?;
                    self.inner
                        .commit(Some("HEAD"), &sig, &sig, "Auto-sync commit", &tree, &[&parent])
                        .map_err(|e| e.to_string())?;
                }
                None => {
                    trace!("Unborn branch, creating initial commit");
                    self.inner
                        .commit(Some("HEAD"), &sig, &sig, "Auto-sync commit", &tree, &[])
                        .map_err(|e| e.to_string())?;
                }
            },
            Err(_) => {
                self.inner
                    .commit(Some("HEAD"), &sig, &sig, "Auto-sync commit", &tree, &[])
                    .map_err(|e| e.to_string())?;
            }
        }
        trace!("Commit completed successfully");
        Ok(())
    }

    pub fn fetch_all_branches(&self) -> Result<(), String> {
        trace!("Fetching all branches from remote...");

        let url = self
            .remote_url
            .as_deref()
            .ok_or_else(|| "No remote URL configured".to_string())?;
        let user = self
            .user_name
            .as_deref()
            .ok_or_else(|| "No username configured".to_string())?;
        let pass = self
            .password
            .as_deref()
            .ok_or_else(|| "No password configured".to_string())?;

        let mut remote = self
            .inner
            .find_remote("origin")
            .or_else(|_| self.inner.remote("origin", url))
            .map_err(|e| format!("Failed to find or create remote: {}", e))?;

        let user = user.to_string();
        let pass = pass.to_string();
        let mut callbacks = git2::RemoteCallbacks::new();
        callbacks.credentials(move |_url, _username, _allowed| {
            git2::Cred::userpass_plaintext(&user, &pass).map_err(|e| {
                git2::Error::new(git2::ErrorCode::Auth, git2::ErrorClass::Callback, &e.to_string())
            })
        });
        callbacks.certificate_check(|_, _| Ok(git2::CertificateCheckStatus::CertificateOk));

        let mut fetch_opts = git2::FetchOptions::new();
        fetch_opts.remote_callbacks(callbacks);

        remote
            .fetch::<&str>(&[], Some(&mut fetch_opts), None)
            .map_err(|e| format!("Fetch failed: {}", e))?;

        trace!("Fetch completed successfully");
        Ok(())
    }

    pub fn latest_commit(&self) -> Result<(git2::Oid, String), String> {
        trace!("Finding latest commit across all branches...");

        let mut latest_oid = git2::Oid::zero();
        let mut latest_ref_name = String::new();
        let mut latest_time: i64 = 0;

        for ref_result in self.inner.references().map_err(|e| e.to_string())? {
            let reference = ref_result.map_err(|e| e.to_string())?;
            let name = reference.name().unwrap_or("");

            if !name.starts_with("refs/heads/") && !name.starts_with("refs/remotes/") {
                continue;
            }

            if let Some(oid) = reference.target() {
                if let Ok(commit) = self.inner.find_commit(oid) {
                    let time = commit.time().seconds();
                    if time > latest_time || (time == latest_time && latest_oid.is_zero()) {
                        latest_time = time;
                        latest_oid = oid;
                        latest_ref_name = name.to_string();
                    }
                }
            }
        }

        if latest_oid.is_zero() {
            return Err("No commits found in repository".to_string());
        }

        trace!(
            "Latest commit: {} on ref: {} (time: {})",
            latest_oid,
            latest_ref_name,
            latest_time
        );
        Ok((latest_oid, latest_ref_name))
    }

    pub fn merge_theirs(&self, their_oid: git2::Oid) -> Result<(), String> {
        trace!("Merging commit {} with theirs strategy...", their_oid);

        let their_commit = self.inner.find_commit(their_oid).map_err(|e| e.to_string())?;
        let their_annotated = self
            .inner
            .find_annotated_commit(their_oid)
            .map_err(|e| e.to_string())?;

        let (analysis, preference) = self
            .inner
            .merge_analysis(&[&their_annotated])
            .map_err(|e| e.to_string())?;

        if analysis.is_up_to_date() {
            trace!("Already up-to-date, nothing to merge");
            return Ok(());
        }

        if analysis.is_fast_forward() && !preference.is_no_fast_forward() {
            trace!("Fast-forwarding to commit {}", their_oid);
            let mut head_ref = self.inner.head().map_err(|e| e.to_string())?;
            head_ref
                .set_target(their_oid, "Fast-forward")
                .map_err(|e| e.to_string())?;
            self.inner
                .set_head(
                    head_ref
                        .name()
                        .ok_or_else(|| "HEAD has no name".to_string())?,
                )
                .map_err(|e| e.to_string())?;
            self.inner
                .checkout_head(Some(
                    git2::build::CheckoutBuilder::default().force(),
                ))
                .map_err(|e| e.to_string())?;
            trace!("Fast-forward completed");
            return Ok(());
        }

        if analysis.is_normal() {
            trace!("Performing normal merge with theirs strategy");
            let our_commit = self
                .inner
                .head()
                .map_err(|e| e.to_string())?
                .peel_to_commit()
                .map_err(|e| e.to_string())?;
            let their_tree = their_commit.tree().map_err(|e| e.to_string())?;

            let sig =
                git2::Signature::now("vertext", "vertext@local").map_err(|e| e.to_string())?;

            let merge_oid = self
                .inner
                .commit(
                    Some("HEAD"),
                    &sig,
                    &sig,
                    "Merge latest remote commit",
                    &their_tree,
                    &[&our_commit, &their_commit],
                )
                .map_err(|e| e.to_string())?;

            let merge_commit = self.inner.find_commit(merge_oid).map_err(|e| e.to_string())?;
            let merge_tree = merge_commit.tree().map_err(|e| e.to_string())?;
            self.inner
                .checkout_tree(
                    merge_tree.as_object(),
                    Some(git2::build::CheckoutBuilder::default().force()),
                )
                .map_err(|e| e.to_string())?;

            trace!("Merge completed: {}", merge_oid);
            return Ok(());
        }

        Err(format!(
            "Unhandled merge analysis result: is_uptodate={}, is_ff={}, is_normal={}",
            analysis.is_up_to_date(),
            analysis.is_fast_forward(),
            analysis.is_normal()
        ))
    }

    pub fn push_all_branches(&self) -> Result<(), String> {
        trace!("Pushing all branches to remote...");

        let url = self
            .remote_url
            .as_deref()
            .ok_or_else(|| "No remote URL configured".to_string())?;
        let user = self
            .user_name
            .as_deref()
            .ok_or_else(|| "No username configured".to_string())?;
        let pass = self
            .password
            .as_deref()
            .ok_or_else(|| "No password configured".to_string())?;

        let mut remote = self
            .inner
            .find_remote("origin")
            .or_else(|_| self.inner.remote("origin", url))
            .map_err(|e| format!("Failed to find or create remote: {}", e))?;

        let user = user.to_string();
        let pass = pass.to_string();
        let mut callbacks = git2::RemoteCallbacks::new();
        callbacks.credentials(move |_url, _username, _allowed| {
            git2::Cred::userpass_plaintext(&user, &pass).map_err(|e| {
                git2::Error::new(git2::ErrorCode::Auth, git2::ErrorClass::Callback, &e.to_string())
            })
        });
        callbacks.certificate_check(|_, _| Ok(git2::CertificateCheckStatus::CertificateOk));

        let mut push_opts = git2::PushOptions::new();
        push_opts.remote_callbacks(callbacks);

        let mut refspecs: Vec<String> = Vec::new();
        for branch_result in self
            .inner
            .branches(Some(git2::BranchType::Local))
            .map_err(|e| e.to_string())?
        {
            let (branch, _) = branch_result.map_err(|e| e.to_string())?;
            if let Ok(Some(name)) = branch.name() {
                refspecs.push(format!("refs/heads/{}:refs/heads/{}", name, name));
            }
        }
        if refspecs.is_empty() {
            return Err("No local branches to push".to_string());
        }
        let refspec_strs: Vec<&str> = refspecs.iter().map(|s| s.as_str()).collect();
        remote
            .push(&refspec_strs, Some(&mut push_opts))
            .map_err(|e| format!("Push failed: {}", e))?;

        trace!("Push completed successfully");
        Ok(())
    }

    pub fn setup_remote(&self) -> Result<(), String> {
        let url = self
            .remote_url
            .as_deref()
            .ok_or_else(|| "No remote URL configured".to_string())?;
        match self.inner.find_remote("origin") {
            Ok(remote) => {
                if remote.url().unwrap_or("") != url {
                    self.inner
                        .remote_set_url("origin", url)
                        .map_err(|e| e.to_string())?;
                    trace!("Updated origin remote URL");
                }
            }
            Err(_) => {
                self.inner
                    .remote("origin", url)
                    .map_err(|e| e.to_string())?;
                trace!("Created origin remote");
            }
        }
        Ok(())
    }

    pub fn head_oid(&self) -> Result<git2::Oid, String> {
        self.inner
            .head()
            .map_err(|e| e.to_string())?
            .target()
            .ok_or_else(|| "HEAD has no target".to_string())
    }

    pub fn history(&self) -> Result<Vec<CommitInfo>, String> {
        let mut revwalk = self.inner.revwalk().map_err(|e| e.to_string())?;
        revwalk.push_glob("refs/heads/*").map_err(|e| e.to_string())?;
        revwalk.push_glob("refs/remotes/*").map_err(|e| e.to_string())?;

        let mut oid_branches = std::collections::HashMap::new();
        let mut oid_tags = std::collections::HashMap::new();

        for ref_result in self.inner.references().map_err(|e| e.to_string())? {
            let reference = ref_result.map_err(|e| e.to_string())?;
            let name = reference.name().unwrap_or("");
            if let Some(oid) = reference.target() {
                if name.starts_with("refs/heads/") {
                    let branch = name.strip_prefix("refs/heads/").unwrap_or(name);
                    oid_branches
                        .entry(oid)
                        .or_insert_with(Vec::new)
                        .push(branch.to_string());
                } else if name.starts_with("refs/tags/") {
                    let tag = name.strip_prefix("refs/tags/").unwrap_or(name);
                    oid_tags
                        .entry(oid)
                        .or_insert_with(Vec::new)
                        .push(tag.to_string());
                }
            }
        }

        let head_oid = self
            .inner
            .head()
            .ok()
            .and_then(|h| h.target());

        let mut commits: Vec<CommitInfo> = Vec::new();
        for oid_result in revwalk {
            let oid = oid_result.map_err(|e| e.to_string())?;
            let commit = self.inner.find_commit(oid).map_err(|e| e.to_string())?;
            commits.push(CommitInfo {
                oid: oid.to_string()[..7].to_string(),
                full_oid: oid.to_string(),
                message: commit
                    .message()
                    .unwrap_or("")
                    .lines()
                    .next()
                    .unwrap_or("")
                    .to_string(),
                author: commit.author().name().unwrap_or("").to_string(),
                time: commit.time().seconds(),
                branches: oid_branches.get(&oid).cloned().unwrap_or_default(),
                tags: oid_tags.get(&oid).cloned().unwrap_or_default(),
                is_head: head_oid == Some(oid),
            });
        }

        Ok(commits)
    }

    pub fn restore_to(&self, target_oid: git2::Oid) -> Result<(), String> {
        let target_commit = self.inner.find_commit(target_oid).map_err(|e| e.to_string())?;
        let target_tree = target_commit.tree().map_err(|e| e.to_string())?;
        let our_head = self.inner.head().map_err(|e| e.to_string())?;
        let our_commit = our_head
            .peel_to_commit()
            .map_err(|e| e.to_string())?;

        let sig = self.inner.signature().map_err(|e| e.to_string())?;

        let msg = format!("Restore to {}", &target_oid.to_string()[..7]);
        let restore_oid = self
            .inner
            .commit(
                Some("HEAD"),
                &sig,
                &sig,
                &msg,
                &target_tree,
                &[&our_commit, &target_commit],
            )
            .map_err(|e| e.to_string())?;

        let restore_commit = self.inner.find_commit(restore_oid).map_err(|e| e.to_string())?;
        let restore_tree = restore_commit.tree().map_err(|e| e.to_string())?;
        self.inner
            .checkout_tree(
                restore_tree.as_object(),
                Some(git2::build::CheckoutBuilder::default().force()),
            )
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}
