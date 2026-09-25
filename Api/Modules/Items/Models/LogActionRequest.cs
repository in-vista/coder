using Newtonsoft.Json;

namespace Api.Modules.Items.Models;

/// <summary>
/// A model containing information on the invocation of an action button as to be logged in the database.
/// </summary>
public class LogActionRequest
{
    /// <summary>
    /// The encrypted item ID of the relevant item for which the action button was invoked.
    /// </summary>
    [JsonProperty("item_id")]
    public string EncryptedItemId { get; set; }
    
    /// <summary>
    /// Optionally, the relevant entity type for which the action button was invoked.
    /// </summary>
    [JsonProperty("entity_type")]
    public string EntityType { get; set; }
    
    /// <summary>
    /// The name of the action button that was invoked.
    /// </summary>
    [JsonProperty("action_button")]
    public string ActionButton { get; set; }
    
    /// <summary>
    /// Optionally, the relevant module ID in which the action button was invoked.
    /// </summary>
    [JsonProperty("module_id")]
    public ulong? ModuleId { get; set; }
    
    /// <summary>
    /// Optionally, the relevant property ID for which the action button was invoked.
    /// </summary>
    [JsonProperty("property_id")]
    public ulong? PropertyId { get; set; }
}