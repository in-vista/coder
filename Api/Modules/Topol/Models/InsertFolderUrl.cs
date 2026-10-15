namespace Api.Modules.Topol.Models;

/// <summary>
/// A model containing the URL of a recently inserted folder in the custom Topol file system.
/// </summary>
public class InsertFolderUrl
{
    /// <summary>
    /// The URL of the directory which was recently inserted.
    /// </summary>
    public string Url { get; set; }
}