namespace Api.Modules.Grids.Models;

/// <summary>
/// A model that defines triggerable fields from a module.
/// </summary>
public class TriggerableFieldModel
{
    /// <summary>
    /// The names of the fields that are triggerable.
    /// </summary>
    public string[] Fields { get; set; }
    
    /// <summary>
    /// The query ID from the <c>wiser_query</c> table to execute once the field is updated.
    /// </summary>
    public int QueryId { get; set; }
}