using Newtonsoft.Json;

namespace Api.Modules.Items.Models;

public class ImageCuratorPool
{
    [JsonProperty("name")]
    public string PropertyName { get; private set; }
}