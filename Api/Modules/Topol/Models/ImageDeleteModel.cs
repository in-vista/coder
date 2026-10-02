using Api.Modules.Topol.Enums;

namespace Api.Modules.Topol.Models;

/// <summary>
/// A model containing information on an image deletion from the Topol file system.
/// </summary>
public class ImageDeleteModel
{
    /// <summary>
    /// The name of the file to delete.
    /// </summary>
    public string Name { get; set; }
    
    /// <summary>
    /// The type of the file to delete.
    /// </summary>
    public FileType Type { get; set; }
    
    /// <summary>
    /// The path that leads to the file to delete.
    /// </summary>
    public string Path { get; set; }
}