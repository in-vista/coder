namespace Api.Modules.Kendo.Models;

/// <summary>
/// A model containing the definitions for a filter used for server-side filtering for comboboxes.
/// </summary>
public class ComboboxFilterModel
{
    /// <summary>
    /// The field name that is being filtered on.
    /// </summary>
    public string Field { get; set; }
    
    /// <summary>
    /// Whether to ignore case-sensitity during filtering.
    /// </summary>
    public bool IgnoreCase { get; set; }
    
    /// <summary>
    /// The operator which is used to filter.
    /// </summary>
    public string Operator { get; set; }
    
    /// <summary>
    /// The input value to filter against the field name.
    /// </summary>
    public string Value { get; set; }
}