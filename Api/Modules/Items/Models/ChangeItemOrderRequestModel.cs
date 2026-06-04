namespace Api.Modules.Items.Models;

public class ChangeItemOrderRequestModel
{
    /// <summary>
    /// The encrypted ID of the item that is being moved.
    /// </summary>
    public string EncryptedItemId { get; set; }
    
    /// <summary>
    /// The index in the grid where the item was previously positioned.
    /// </summary>
    public int OldIndex { get; set; }
    
    /// <summary>
    /// The index in the grid where the item is currently positioned.
    /// </summary>
    public int NewIndex { get; set; }
}