namespace Api.Modules.Grids.Models;

/// <summary>
/// A model that defines an editable field from a module.
/// </summary>
public class EditableFieldModel
{
    /// <summary>
    /// The name of the associated field that is editable.
    /// </summary>
    public string[] Fields { get; set; }
    
    /// <summary>
    /// The query ID from the <c>wiser_query</c> table to execute once the field is updated.
    /// </summary>
    public int QueryId { get; set; }
}