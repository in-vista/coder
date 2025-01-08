using Newtonsoft.Json.Linq;

namespace Api.Modules.Topol.Models;

public class TopolTemplate
{
    public ulong Id { get; set; }
    
    public string Title { get; set; }
    
    public JObject Json { get; set; }
    
    public string Html { get; set; }
}