namespace Api.Modules.Items.Models;

public class ChangeItemOrderRequestModel
{
    /// <summary>
    /// The encrypted ID of the item that is being moved.
    /// </summary>
    public string EncryptedItemId { get; set; }
    
    /// <summary>
    /// The entity type of the item.
    /// </summary>
    public string EntityType { get; set; }
    
    /// <summary>
    /// The encrypted ID of the item that the currently dragged item is being placed behind.
    /// </summary>
    public string BeforeEncryptedItemId { get; set; }
}