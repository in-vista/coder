namespace Api.Modules.Items.Models;

/// <summary>
/// A model containing information on how an entry in a context menu is presented.
/// </summary>
public class ContextMenuItem
{
    /// <summary>
    /// The text that is shown as the item is presented in the context menu.
    /// </summary>
    public string Text { get; set; }
    
    /// <summary>
    /// The sprite class name of the icon of this item.
    /// </summary>
    public string SpriteCssClass { get; set; }
    
    /// <summary>
    /// The underlying action to perform when this item is invoked by the user.
    /// </summary>
    public string Action { get; set; }
    
    /// <summary>
    /// The name of the entity type which is relevant for item.
    /// </summary>
    public string EntityType { get; set; }
}