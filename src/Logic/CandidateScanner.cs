using System;
using System.Collections.Generic;
using System.Linq;

namespace EmbyCleanupCandidates.Logic
{
    public class PlayRecord
    {
        public string User { get; set; }
        public DateTime? LastPlayedUtc { get; set; }
        public int PlayCount { get; set; }
    }

    public class UserPlay
    {
        public string User { get; set; }
        public DateTime? LastPlayedUtc { get; set; }
        public int PlayCount { get; set; }
    }

    public class MediaFile
    {
        public string Library { get; set; }
        public string Folder { get; set; }
        public string Name { get; set; }
        public long SizeBytes { get; set; }
        public DateTime AddedUtc { get; set; }
        public int Items { get; set; } = 1;
        public List<PlayRecord> Plays { get; set; } = new List<PlayRecord>();
    }

    public class Candidate
    {
        public string Library { get; set; }
        public string Folder { get; set; }
        public string Name { get; set; }
        public long SizeBytes { get; set; }
        public int Items { get; set; }
        public DateTime AddedUtc { get; set; }
        public DateTime? LastPlayedUtc { get; set; }
        public string LastPlayedBy { get; set; }
        public int TotalPlays { get; set; }
        public List<UserPlay> Users { get; set; } = new List<UserPlay>();
    }

    public static class CandidateScanner
    {
        /// <summary>
        /// Groups files by folder and returns folders nobody has played, and that were added,
        /// before the cutoff. Excluded folders and libraries are dropped.
        /// </summary>
        public static List<Candidate> Scan(
            IEnumerable<MediaFile> files,
            DateTime cutoffUtc,
            ISet<string> excludedLibraries,
            ISet<string> keptFolders)
        {
            var result = new List<Candidate>();
            foreach (var g in files
                .Where(f => !excludedLibraries.Contains(f.Library) && !keptFolders.Contains(f.Folder))
                .GroupBy(f => f.Folder))
            {
                var latest = g.SelectMany(f => f.Plays)
                    .Where(p => p.LastPlayedUtc.HasValue)
                    .OrderByDescending(p => p.LastPlayedUtc)
                    .FirstOrDefault();
                var added = g.Max(f => f.AddedUtc);

                if (added >= cutoffUtc) continue;
                if (latest != null && latest.LastPlayedUtc.Value >= cutoffUtc) continue;

                var first = g.First();
                result.Add(new Candidate
                {
                    Library = first.Library,
                    Folder = g.Key,
                    Name = first.Name,
                    SizeBytes = g.Sum(f => f.SizeBytes),
                    Items = g.Sum(f => f.Items),
                    AddedUtc = added,
                    LastPlayedUtc = latest?.LastPlayedUtc,
                    LastPlayedBy = latest?.User,
                    TotalPlays = g.SelectMany(f => f.Plays).Sum(p => p.PlayCount),
                    Users = g.SelectMany(f => f.Plays)
                        .GroupBy(p => p.User)
                        .Select(u => new UserPlay
                        {
                            User = u.Key,
                            LastPlayedUtc = u.Max(p => p.LastPlayedUtc),
                            PlayCount = u.Sum(p => p.PlayCount)
                        })
                        .Where(u => u.PlayCount > 0 || u.LastPlayedUtc.HasValue)
                        .OrderByDescending(u => u.LastPlayedUtc)
                        .ToList()
                });
            }
            return result.OrderByDescending(c => c.SizeBytes).ToList();
        }
    }
}
