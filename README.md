# Emby Cleanup Candidates

Read-only Emby plugin. Lists folders (movies, whole series) that nobody has played within a set number of months, with size, item count and last watcher. It never deletes anything.

- A folder is a candidate when it was added before the cutoff and no user has played any item in it since.
- "Added" is the file mtime, since Emby's `DateCreated` is the air date.
- Settings: months, excluded libraries, kept folders (full paths).
- Endpoint: `GET /emby/CleanupCandidates` (admin only), JSON sorted by size.
- Config page: Dashboard, Plugins, Cleanup Candidates. Run the report and show it as CSV.

## Build and install

```bash
./build.sh
```

Copy `dist/EmbyCleanupCandidates.dll` into the Emby `plugins` folder and restart Emby. Needs the .NET 8 SDK.

Built against `MediaBrowser.Server.Core` 4.9.1.90. Untested against a live server so far.
