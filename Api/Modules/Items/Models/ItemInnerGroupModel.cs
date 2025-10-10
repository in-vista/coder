namespace Api.Modules.Items.Models;

public class ItemInnerGroupModel : ItemTabOrGroupModel
{
    /// <summary>
    /// The property name in the item's HTML of which the tabs of this group are based on.
    /// </summary>
    public string TabPropertyName { get; set; }
    
    /// <summary>
    /// The property name that the tab strip is based on.
    /// </summary>
    public string PropertyName { get; set; }
}