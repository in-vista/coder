using Newtonsoft.Json.Linq;

namespace Api.Modules.Topol.Models;

/// <summary>
/// A model containing information on a Topol template as stored in the file system.
/// </summary>
public class TopolTemplate
{
    /// <summary>
    /// The unique identifier of the template.
    /// </summary>
    public ulong Id { get; set; }
    
    /// <summary>
    /// The title of the template.
    /// </summary>
    public string Title { get; set; }
    
    /// <summary>
    /// The information of the template that defines all the template's attributes.
    /// </summary>
    public JObject Json { get; set; }
    
    /// <summary>
    /// The raw HTML content of the template.
    /// </summary>
    public string Html { get; set; }
}