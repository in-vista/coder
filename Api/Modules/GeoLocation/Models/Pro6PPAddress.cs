using System.Collections.Generic;
using Newtonsoft.Json;

namespace Api.Modules.GeoLocation.Models;

public class Pro6PPAddress
{
    [JsonProperty("constructionYear")]
    public int ConstructionYear { get; set; }

    [JsonProperty("country")]
    public string Country { get; set; }

    [JsonProperty("countryCode")]
    public string CountryCode { get; set; }

    [JsonProperty("lat")]
    public double Latitude { get; set; }

    [JsonProperty("lng")]
    public double Longitude { get; set; }

    [JsonProperty("municipality")]
    public string Municipality { get; set; }

    [JsonProperty("postalCode")]
    public string PostalCode { get; set; }

    [JsonProperty("province")]
    public string Province { get; set; }

    [JsonProperty("purposes")]
    public List<string> Purposes { get; set; }

    [JsonProperty("settlement")]
    public string Settlement { get; set; }

    [JsonProperty("street")]
    public string Street { get; set; }

    [JsonProperty("streetNumber")]
    public int StreetNumber { get; set; }

    [JsonProperty("surfaceArea")]
    public int SurfaceArea { get; set; }
}