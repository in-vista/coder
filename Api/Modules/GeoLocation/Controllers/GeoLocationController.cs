using System.Threading.Tasks;
using Api.Modules.GeoLocation.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Api.Modules.GeoLocation.Controllers;

[Route("api/v3/geolocation")]
public class GeoLocationController : ControllerBase
{
    private readonly IGeoLocationService geoLocationService;
    
    public GeoLocationController(IGeoLocationService geoLocationService)
    {
        this.geoLocationService = geoLocationService;
    }
    
    [HttpGet("pro6pp")]
    public async Task<IActionResult> GetPro6PPAddress([FromQuery] string zipCode, [FromQuery] int? houseNumber, [FromQuery] string premise)
    {
        return (await geoLocationService.GetPro6PPAddress(zipCode, houseNumber, premise)).GetHttpResponseMessage();
    }
}