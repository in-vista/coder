using System.ComponentModel.DataAnnotations;

namespace Api.Modules.Modules.Models;

/// <summary>
/// A model for storing the amount of pending actions a module has.
/// </summary>
public class ModulePendingActionsModel
{
    /// <summary>
    /// Gets or sets the ID.
    /// </summary>
    [Key]
    public int ModuleId { get; set; }
    /// <summary>
    /// The amount of pending actions in a module.
    /// </summary>
    public int PendingActionCount { get; set; }
}