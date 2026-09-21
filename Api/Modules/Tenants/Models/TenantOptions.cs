using Newtonsoft.Json;

namespace Api.Modules.Tenants.Models;

/// <summary>
/// A model containing styling information of the tenant.
/// </summary>
public class TenantOptions
{
    /// <summary>
    /// The relative path for the logo shown in the sidebar.
    /// </summary>
    [JsonProperty("logo")]
    public string Logo { get; set; } = "img/logo-coder.png";
    
    /// <summary>
    /// The foreground color for the majority of the text and icons.
    /// </summary>
    [JsonProperty("foreground_color")]
    public string ForegroundColor { get; set; } = "#2F2F2F";
    
    /// <summary>
    /// The background-color used for the sidebar.
    /// </summary>
    [JsonProperty("background_color")]
    public string BackgroundColor { get; set; } = "#F8F8F8";
    
    /// <summary>
    /// The primary color used in the color palette.
    /// </summary>
    [JsonProperty("primary_color")]
    public string PrimaryColor { get; set; } = "#031B53";
    
    /// <summary>
    /// The secondary color used in the color palette.
    /// </summary>
    [JsonProperty("secondary_color")]
    public string SecondaryColor { get; set; } = "#FFFFFF";
    
    /// <summary>
    /// The color used as highligting in special occassions.
    /// </summary>
    [JsonProperty("tertiary_color")]
    public string TertiaryColor { get; set; } = "#23CAAB";
    
    /// <summary>
    /// 
    /// </summary>
    [JsonProperty("icon_color")]
    public string IconColor { get; set; } = "#FFFFFF";
}