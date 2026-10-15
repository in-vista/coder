namespace Api.Modules.Topol.Models;

/// <summary>
/// A model containing information on the result of the insertion of one or more folders in the custom Topol file system.
/// </summary>
public class InsertFolderResponse
{
    /// <summary>
    /// A collection of URLs that have been inserted in the custom Topol file system.
    /// </summary>
    public InsertFolderUrl[] Urls { get; set; }
}