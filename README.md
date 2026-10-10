# Emby Cleanup Candidates

An Emby Server plugin that finds media nobody has watched in a long time, shows how much space it takes, and can delete it.

It runs inside Emby and reads play history through Emby's own user data, so it sees every user. On a library of about 4,300 movies and shows it lists 1,631 candidate folders (8.3 TB) in 10 to 30 seconds.

## What counts as a candidate

A folder is a movie, or a whole series. It is listed when both of these are true:

- It was added before the cutoff (24 months by default).
- No user has played any item in it since the cutoff.

"Added" is the newest file's modified time, because Emby's own `DateCreated` is the air date. A series with one recent episode play is never listed.

## Using it

Open Dashboard, Plugins, Cleanup Candidates.

1. **Settings.** Months without a play, libraries to skip (one name per line, for example `Music`), and kept folders (one full path per line, for example `/media/tv-shows/Stargate SG-1 (1997)`). Kept folders never appear again.
2. **Run report.** Sort by any column, filter by name or path, library, or play history, and click a row for the folder path and each user's play count and last play date. Download CSV exports the rows that match your filters.
3. **Purge** (optional, described below).

Reset settings puts months, excluded libraries and kept folders back to their defaults. It doesn't touch media.

## Purge

Purge deletes folders from disk. There is no undo and no recycle bin.

Tick rows in the report, then pick one:

- **Dry run** lists what would be deleted and changes nothing.
- **Delete** stays disabled until you type `DELETE` (capitals) in the box. It then removes each ticked folder and everything inside it, writes a line per folder to `cleanup-candidates-purge.log` in the Emby log folder, and queues a library scan.

Before it deletes anything, the server runs the scan again and accepts only folders that are still candidates. It skips kept folders, excluded libraries, recently played or added folders, and symlinks. That repeat scan makes a dry run take as long as a report.

The Emby container needs write access to the media mount. If the mount is read-only, as it is on the server this was built on, each folder comes back as `failed` with the error and nothing is deleted. One real delete has been run, on that read-only mount: it failed with an access-denied error and removed nothing. Deleting on a writable mount has not been tested.

## API

Both endpoints need an Emby administrator.

- `GET /emby/CleanupCandidates` returns the candidate list as JSON, largest first. Each entry has `Library`, `Folder`, `Name`, `SizeBytes`, `Items`, `AddedUtc`, `LastPlayedUtc`, `LastPlayedBy`, `TotalPlays` and `Users` (per-user plays).
- `POST /emby/CleanupCandidates/Purge` takes `{"Folders": ["/media/..."], "Execute": false}`. `Execute` defaults to false, so leaving it out is a dry run.

## Build and install

You need the .NET 8 SDK.

```bash
./build.sh
```

That runs the 7 tests in `tests/` and writes `dist/EmbyCleanupCandidates.dll`. Copy it into Emby's `plugins` folder and restart Emby. Hard-refresh the browser afterwards, because Emby's web client caches plugin pages.

Built against `MediaBrowser.Server.Core` 4.9.1.90 and checked on Emby Server 4.10.1.0 running in Docker.

MIT licensed.
