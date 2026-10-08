using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using EmbyCleanupCandidates.Logic;
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

    public class CandidatesService : IService
    {
        private readonly ILibraryManager _library;
        private readonly IUserManager _users;
        private readonly IUserDataManager _userData;

        public CandidatesService(ILibraryManager library, IUserManager users, IUserDataManager userData)
        {
            _library = library;
            _users = users;
            _userData = userData;
        }

        public object Get(GetCandidates request)
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
                    LastPlayedUtc = _userData.GetUserData(u, item)?.LastPlayedDate?.UtcDateTime
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
