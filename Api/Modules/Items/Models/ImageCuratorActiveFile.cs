using Newtonsoft.Json;

namespace Api.Modules.Items.Models;

/// <summary>
/// A model containing information of an active file in the image curator field template.
/// </summary>
public class ImageCuratorActiveFile
{
    /// <summary>
    /// The file ID of the image as stored in the dedicated file database tables.
    /// </summary>
    [JsonProperty("fileId")]
    public ulong FileId { get; private set; }
    
    /// <summary>
    /// The ordering the image has as presented in the image curator field template.
    /// </summary>
    [JsonProperty("ordering")]
    public int Ordering { get; private set; }
}