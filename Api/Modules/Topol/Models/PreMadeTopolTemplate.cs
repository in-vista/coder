using System;
using Api.Modules.Topol.Utility;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace Api.Modules.Topol.Models;

[JsonObject(NamingStrategyType = typeof(SnakeCaseNamingStrategy))]
public class PreMadeTopolTemplate
{
    public ulong Id { get; set; }
    
    public string Name { get; set; }
    
    public TemplateType Type { get; set; }
    
    public string Html { get; set; }
    
    public string Json { get; set; }
    
    public int CategoryId { get; set; }
    
    public int Order { get; set; }
    
    public string Description { get; set; }
    
    [JsonConverter(typeof(BoolToIntConverter))]
    public bool Visible { get; set; }
    
    public DateTime CreatedAt { get; set; }
    
    public DateTime UpdatedAt { get; set; }
    
    public String ImagePath { get; set; }
    
    public string ImageThumbPath { get; set; }
    
    public string ImgThumbUrl { get; set; }
    
    public string Category { get; set; }
    
    public string[] Keywords { get; set; }
}