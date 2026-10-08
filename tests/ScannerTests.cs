using System;
using System.Collections.Generic;
using EmbyCleanupCandidates.Logic;
using Xunit;

public class ScannerTests
{
    static readonly DateTime Now = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
    static readonly DateTime Cutoff = Now.AddMonths(-24);
    static readonly ISet<string> None = new HashSet<string>();

    static MediaFile F(string folder, DateTime added, params DateTime?[] played)
    {
        var f = new MediaFile { Library = "movies", Folder = folder, Name = folder, SizeBytes = 100, AddedUtc = added };
        foreach (var p in played) f.Plays.Add(new PlayRecord { User = "u", LastPlayedUtc = p });
        return f;
    }

    [Fact] public void NeverPlayedAndOld_IsCandidate() =>
        Assert.Single(CandidateScanner.Scan(new[] { F("a", Cutoff.AddDays(-1)) }, Cutoff, None, None));

    [Fact] public void RecentlyAdded_IsNotCandidate() =>
        Assert.Empty(CandidateScanner.Scan(new[] { F("a", Now) }, Cutoff, None, None));

    [Fact] public void RecentPlayByAnyone_IsNotCandidate() =>
        Assert.Empty(CandidateScanner.Scan(new[] { F("a", Cutoff.AddYears(-3), Cutoff.AddYears(-2), Now) }, Cutoff, None, None));

    [Fact] public void EpisodesGroupIntoOneFolderAndSumSize()
    {
        var r = CandidateScanner.Scan(new[] { F("show", Cutoff.AddYears(-3)), F("show", Cutoff.AddYears(-3)) }, Cutoff, None, None);
        Assert.Equal(200, Assert.Single(r).SizeBytes);
    }

    [Fact] public void OneRecentEpisodeKeepsWholeShow() =>
        Assert.Empty(CandidateScanner.Scan(new[] { F("show", Cutoff.AddYears(-3)), F("show", Now) }, Cutoff, None, None));

    [Fact] public void ExcludedLibraryAndKeptFolder_AreDropped()
    {
        var files = new[] { F("a", Cutoff.AddYears(-1)), F("b", Cutoff.AddYears(-1)) };
        Assert.Empty(CandidateScanner.Scan(files, Cutoff, new HashSet<string> { "movies" }, None));
        Assert.Equal("b", Assert.Single(CandidateScanner.Scan(files, Cutoff, None, new HashSet<string> { "a" })).Folder);
    }
}
