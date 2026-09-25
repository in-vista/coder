using System.Collections.Generic;
using Newtonsoft.Json;

namespace Api.Modules.GeoLocation.Models;

/// <summary>
/// A geogrpahical model holding data of an address as retrieved from the Pro6PP API.
/// </summary>
public class Pro6PPAddress
{
    /// <summary>
    /// The year the area of the address was originally constructed.
    /// </summary>
    [JsonProperty("constructionYear")]
    public int ConstructionYear { get; set; }
    
    /// <summary>
    /// The user-friendly name of the country of the address.
    /// </summary>
    [JsonProperty("country")]
    public string Country { get; set; }

    /// <summary>
    /// The country code of the address.
    /// </summary>
    [JsonProperty("countryCode")]
    public string CountryCode { get; set; }

    /// <summary>
    /// The latitude value of the specific address location.
    /// </summary>
    [JsonProperty("lat")]
    public double Latitude { get; set; }

    /// <summary>
    /// The longitude value of the specific address location.
    /// </summary>
    [JsonProperty("lng")]
    public double Longitude { get; set; }

    /// <summary>
    /// The user-friendly name of the municipality of the address.
    /// </summary>
    [JsonProperty("municipality")]
    public string Municipality { get; set; }

    /// <summary>
    /// The postal code (aka "zip code") of the address.
    /// </summary>
    [JsonProperty("postalCode")]
    public string PostalCode { get; set; }

    /// <summary>
    /// The user-friendly name of the province/state of the address.
    /// </summary>
    [JsonProperty("province")]
    public string Province { get; set; }

    /// <summary>
    /// Any additional purposes retrieved from the geographical API.
    /// </summary>
    [JsonProperty("purposes")]
    public List<string> Purposes { get; set; }

    /// <summary>
    /// The user-friendly name of the city/town/village/hamlet of the address.
    /// </summary>
    [JsonProperty("settlement")]
    public string Settlement { get; set; }

    /// <summary>
    /// The user-friendly name of the street of the address.
    /// </summary>
    [JsonProperty("street")]
    public string Street { get; set; }

    /// <summary>
    /// The house number of the address within the street.
    /// </summary>
    [JsonProperty("streetNumber")]
    public int StreetNumber { get; set; }

    /// <summary>
    /// The amount of square meters the address covers on the map.
    /// </summary>
    [JsonProperty("surfaceArea")]
    public int SurfaceArea { get; set; }
}