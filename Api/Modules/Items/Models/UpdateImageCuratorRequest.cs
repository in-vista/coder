using Newtonsoft.Json;

namespace Api.Modules.Items.Models;

/// <summary>
/// A request model used to hold the state of the active files in the image curator field template.
/// </summary>
public class UpdateImageCuratorRequest
{
    /// <summary>
    /// A collection of activate files within an image curator as it currently stands.
    /// </summary>
    [JsonProperty("files")]
    public ImageCuratorActiveFile[] Files { get; private set; }
}