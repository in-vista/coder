using Newtonsoft.Json;

namespace Api.Modules.Items.Models;

public class ImageCuratorActiveFile
{
    [JsonProperty("fileId")]
    public ulong FileId { get; private set; }
    
    [JsonProperty("ordering")]
    public int Ordering { get; private set; }
}