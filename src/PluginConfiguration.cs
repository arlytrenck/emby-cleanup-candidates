using MediaBrowser.Model.Plugins;

namespace EmbyCleanupCandidates
{
    public class PluginConfiguration : BasePluginConfiguration
    {
        public int Months { get; set; } = 24;
        public string ExcludedLibraries { get; set; } = "";
        public string KeptFolders { get; set; } = "";
    }
}
