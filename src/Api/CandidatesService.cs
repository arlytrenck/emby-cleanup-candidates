using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using EmbyCleanupCandidates.Logic;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Model.Querying;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Services;

namespace EmbyCleanupCandidates.Api
{
    [Route("/CleanupCandidates", "GET", Summary = "Folders nobody has played within the configured window")]
    [Authenticated(Roles = "Admin")]
    public class GetCandidates : IReturn<List<Candidate>>
    {
    }

    [Route("/CleanupCandidates/Purge", "POST", Summary = "Dry-run or delete candidate folders from disk")]
    [Authenticated(Roles = "Admin")]
    public class PurgeCandidates : IReturn<List<PurgeResult>>
    {
        public string[] Folders { get; set; }
        /// <summary>False (the default) only reports what would be deleted.</summary>
        public bool Execute { get; set; }
    }

    public class PurgeResult
    {
        public string Folder { get; set; }
        public string Status { get; set; }
        public long SizeBytes { get; set; }
        public string Detail { get; set; }
    }

    public class CandidatesService : IService
    {
        private readonly ILibraryManager _library;
        private readonly IUserManager _users;
        private readonly IUserDataManager _userData;

        private readonly IApplicationPaths _paths;

        public CandidatesService(ILibraryManager library, IUserManager users, IUserDataManager userData, IApplicationPaths paths)
        {
            _paths = paths;
            _library = library;
            _users = users;
            _userData = userData;
        }

        public object Get(GetCandidates request) => Scan();

        public object Post(PurgeCandidates request)
        {
            var candidates = Scan().ToDictionary(c => c.Folder);
            var results = new List<PurgeResult>();
            var log = new List<string>();

            foreach (var folder in (request.Folders ?? new string[0]).Distinct())
            {
                var r = new PurgeResult { Folder = folder };
                results.Add(r);

                Candidate c;
                if (!candidates.TryGetValue(folder, out c))
                {
                    r.Status = "rejected";
                    r.Detail = "Not a current candidate (kept, excluded, played or added recently).";
                    continue;
                }
                r.SizeBytes = c.SizeBytes;

                var dir = new DirectoryInfo(folder);
                if (!dir.Exists)
                {
                    r.Status = "missing";
                    r.Detail = "Folder does not exist on disk.";
                    continue;
                }
                if ((dir.Attributes & FileAttributes.ReparsePoint) != 0)
                {
                    r.Status = "rejected";
                    r.Detail = "Folder is a symlink; refusing to follow it.";
                    continue;
                }
                if (!request.Execute)
                {
                    r.Status = "would delete";
                    continue;
                }

                try
                {
                    dir.Delete(true);
                    r.Status = "deleted";
                }
                catch (Exception ex)
                {
                    r.Status = "failed";
                    r.Detail = ex.Message;
                }
                log.Add(DateTime.UtcNow.ToString("o") + "\t" + r.Status + "\t" + r.SizeBytes + "\t" + folder + "\t" + r.Detail);
            }

            if (log.Count > 0)
            {
                try { File.AppendAllLines(Path.Combine(_paths.LogDirectoryPath, "cleanup-candidates-purge.log"), log); }
                catch { }
                if (results.Any(r => r.Status == "deleted")) _library.QueueLibraryScan();
            }
            return results;
        }

        private List<Candidate> Scan()
        {
            var cfg = Plugin.Instance.Configuration;
            var cutoff = DateTime.UtcNow.AddMonths(-Math.Max(1, cfg.Months));
            var excluded = Split(cfg.ExcludedLibraries);
            var kept = Split(cfg.KeptFolders);

            var roots = _library.GetVirtualFolders()
                .SelectMany(v => (v.Locations ?? new string[0]).Select(l => new { v.Name, Path = l.TrimEnd('/', '\\') }))
                .ToList();
            var users = _users.GetUserList(new UserQuery()).ToList();

            var items = _library.GetItemList(new InternalItemsQuery
            {
                IncludeItemTypes = new[] { "Movie", "Episode" },
                Recursive = true
            });

            var files = new List<MediaFile>();
            foreach (var item in items)
            {
                if (string.IsNullOrEmpty(item.Path)) continue;
                var root = roots
                    .Where(r => item.Path.StartsWith(r.Path + Path.DirectorySeparatorChar) || item.Path.StartsWith(r.Path + "/"))
                    .OrderByDescending(r => r.Path.Length).FirstOrDefault();
                if (root == null) continue;

                var rest = item.Path.Substring(root.Path.Length).TrimStart('/', '\\');
                var top = rest.Split('/', '\\')[0];
                var folder = root.Path + "/" + top;

                var plays = users.Select(u => new PlayRecord
                {
                    User = u.Name,
                    LastPlayedUtc = _userData.GetUserData(u, item)?.LastPlayedDate?.UtcDateTime,
                    PlayCount = _userData.GetUserData(u, item)?.PlayCount ?? 0
                }).ToList();

                long size = 0;
                try { size = new FileInfo(item.Path).Length; } catch { }
                DateTime added;
                try { added = File.GetLastWriteTimeUtc(item.Path); } catch { added = item.DateCreated.UtcDateTime; }

                files.Add(new MediaFile
                {
                    Library = root.Name,
                    Folder = folder,
                    Name = item is Episode ? ((Episode)item).SeriesName ?? top : item.Name,
                    SizeBytes = size,
                    AddedUtc = added,
                    Plays = plays
                });
            }

            return CandidateScanner.Scan(files, cutoff, excluded, kept);
        }

        private static HashSet<string> Split(string s) =>
            new HashSet<string>((s ?? "").Split(new[] { '\n', '|' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim()).Where(x => x.Length > 0));
    }
}
