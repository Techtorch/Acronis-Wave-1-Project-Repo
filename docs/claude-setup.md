# Connecting Claude to this repo

## Claude.ai Project
1. Open the Acronis Project in claude.ai.
2. In **Project knowledge**, click **+** → **GitHub** and select `abhi1kalia/Acronis-Wave-1-Project-Repo`.
3. Select the `context/` and `knowledge/` folders, plus `CLAUDE.md`.
4. Keep the Project's own instructions short, for example: _"Follow `context/project-instructions.md` in the synced repo."_ The full instructions live in the repo.
5. After changes are pushed, re-sync the GitHub knowledge in the Project so it picks them up.

## Claude Code
```bash
git clone https://github.com/abhi1kalia/Acronis-Wave-1-Project-Repo.git
cd Acronis-Wave-1-Project-Repo
claude
```
Claude Code loads `CLAUDE.md` (and the files it imports) automatically when started in this folder. Run `git pull` before starting so your context is current.

## Keeping it in sync
- Edit context in the repo, not in chats.
- Commit and push the changes, then re-sync the claude.ai Project.
