using Microsoft.AspNetCore.Http;

namespace Api.Modules.Topol.Models;

/// <summary>
/// A model containing information on an image upload in the custom Topol file system.
/// </summary>
public class UploadImageRequest
{
    /// <summary>
    /// The file to be uploaded from the HTTP form request.
    /// </summary>
    public IFormFile Image { get; set; }
    
    /// <summary>
    /// The path leading to the folder the image is to be uploaded in.
    /// </summary>
    public string Path { get; set; }
    
    /// <summary>
    /// A unique identifier for the image to be identified by the custom Topol file system.
    /// </summary>
    public string Uuid { get; set; }
}