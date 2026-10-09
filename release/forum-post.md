# Cleanup Candidates: find and remove media nobody watches

Cleanup Candidates is a plugin that lists the movies and series nobody has played in a set number of months, and how much space they take. On my library it finds 1,631 folders (8.3 TB) in 10 to 30 seconds.

A folder (a movie, or a whole series) is listed when it was added before your cutoff and no user has played any item in it since. Play history comes from Emby's own user data, so every user counts.

**Report**
- Sort by size, name, last played, plays, or date added.
- Filter by name or path, library, and never played versus played before the cutoff.
- Click a row for the folder path and each user's play count and last play date.
- Download the filtered rows as CSV.
- Kept folders and excluded libraries never show up.

**Purge (optional)**
Tick folders, run a dry run, then type DELETE to remove them from disk. There is no undo and no recycle bin. The server re-checks every folder against the current candidate list and skips symlinks. Each delete is logged to `cleanup-candidates-purge.log` in the Emby log folder.

**Install**
Copy `EmbyCleanupCandidates.dll` into Emby's `plugins` folder, restart the server, then open Dashboard, Plugins, Cleanup Candidates. Hard-refresh the browser if the page looks stale.

**Limits**
Checked on Emby Server 4.10.1.0 in Docker. Delete needs write access to your media mount. On my server the mount is read-only, so Purge reports `failed` and removes nothing. I have only tested dry runs, not a real delete.

Download: https://github.com/arlytrenck/emby-cleanup-candidates/releases/tag/v1.0.0

Source: https://github.com/arlytrenck/emby-cleanup-candidates. MIT licensed.
