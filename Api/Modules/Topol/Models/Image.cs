using System;
using Api.Modules.Topol.Enums;

namespace Api.Modules.Topol.Models;

/// <summary>
/// A model containing information on the definition of an image file in the Topol file system.
/// </summary>
public class Image
{
    /// <summary>
    /// The name of the file.
    /// </summary>
    public string Name { get; set; }
    
    /// <summary>
    /// The creation / change date of the file.
    /// </summary>
    public DateTime Date { get; set; }
    
    /// <summary>
    /// The size in bytes of the file.
    /// </summary>
    public uint Size { get; set; }
    
    /// <summary>
    /// The path of the file in the file system.
    /// </summary>
    public string Path { get; set; }
    
    /// <summary>
    /// The type of file (file / folder).
    /// </summary>
    public FileType Type { get; set; }
    
    /// <summary>
    /// The file extension. This is not applicable for folders.
    /// </summary>
    public string Extension { get; set; }
    
    /// <summary>
    /// The absolute - and thus direct URL of the image.
    /// </summary>
    public string Url { get; set; }
}