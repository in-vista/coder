using Newtonsoft.Json;

namespace Api.Modules.Items.Models;

public class LogActionRequest
{
    [JsonProperty("item_id")]
    public string EncryptedItemId { get; set; }
    
    [JsonProperty("entity_type")]
    public string EntityType { get; set; }
    
    [JsonProperty("action_button")]
    public string ActionButton { get; set; }
    
    [JsonProperty("module_id")]
    public ulong? ModuleId { get; set; }
    
    [JsonProperty("property_id")]
    public ulong? PropertyId { get; set; }
}