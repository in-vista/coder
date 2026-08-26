using Newtonsoft.Json;

namespace Api.Modules.Items.Models;

public class UpdateImageCuratorRequest
{
    [JsonProperty("files")]
    public ImageCuratorActiveFile[] Files { get; private set; }
}