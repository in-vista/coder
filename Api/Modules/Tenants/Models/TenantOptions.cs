using Newtonsoft.Json;

namespace Api.Modules.Tenants.Models;

public class TenantOptions
{
    [JsonProperty("logo")]
    public string Logo { get; set; } = "img/logo-coder.png";
    
    [JsonProperty("foreground_color")]
    public string ForegroundColor { get; set; } = "#2F2F2F";
    
    [JsonProperty("primary_color")]
    public string PrimaryColor { get; set; } = "#031B53";
    
    [JsonProperty("secondary_color")]
    public string SecondaryColor { get; set; } = "#FFFFFF";
}