namespace Api.Modules.Topol.Models;

/// <summary>
/// A model containing information on the request made to insert a folder in the custom Topol file system.
/// </summary>
public class InsertFolderRequest
{
    /// <summary>
    /// The name of the folder to insert.
    /// </summary>
    public string Name { get; set; }
    
    /// <summary>
    /// The relative path leading to this folder.
    /// </summary>
    public string Path { get; set; }
}