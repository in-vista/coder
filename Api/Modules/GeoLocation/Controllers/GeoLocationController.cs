using System.Threading.Tasks;
using Api.Modules.GeoLocation.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Api.Modules.GeoLocation.Controllers;

/// <summary>
/// The API controller that handles incoming requests for geographical-related topics.
/// </summary>
[Route("api/v3/geolocation")]
public class GeoLocationController : ControllerBase
{
    private readonly IGeoLocationService geoLocationService;
    
    /// <summary>
    /// The constructor the the <see cref="GeoLocationController"/> class.
    /// </summary>
    public GeoLocationController(IGeoLocationService geoLocationService)
    {
        this.geoLocationService = geoLocationService;
    }
    
    /// <inheritdoc cref="IGeoLocationService.GetPro6PPAddress"/>
    [HttpGet("pro6pp")]
    public async Task<IActionResult> GetPro6PPAddress([FromQuery] string zipCode, [FromQuery] int? houseNumber, [FromQuery] string premise)
    {
        return (await geoLocationService.GetPro6PPAddress(zipCode, houseNumber, premise)).GetHttpResponseMessage();
    }
}