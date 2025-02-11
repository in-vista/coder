using Newtonsoft.Json;

namespace Api.Modules.Topol.Models;

public class PreMadeTopolTemplatesResult
{
    [JsonProperty(PropertyName = "data")]
    public PreMadeTopolTemplate[] Templates { get; set; }
    
    [JsonProperty(PropertyName = "total_records")]
    public int TotalRecords { get; set; }
    
    [JsonProperty(PropertyName = "current_page")]
    public int CurrentPage { get; set; }
    
    [JsonProperty(PropertyName = "per_page")]
    public int PerPage { get; set; }
    
    [JsonProperty(PropertyName = "next_page")]
    public int? NextPage { get; set; }
    
    [JsonProperty(PropertyName = "prev_page")]
    public int? PreviousPage { get; set; }
    
    [JsonProperty(PropertyName = "last_page")]
    public int LastPage { get; set; }
}