using System.Net.Mime;
using System.Security.Claims;
using System.Threading.Tasks;
using Api.Modules.Styling.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Api.Modules.Styling.Controllers;

[Route("api/v3/[controller]")]
[ApiController]
[Authorize]
[Consumes(MediaTypeNames.Application.Json)]
[Produces(MediaTypeNames.Application.Json)]
public class StylingController : ControllerBase
{
    private readonly IStylingService stylingService;

    public StylingController(IStylingService stylingService)
    {
        this.stylingService = stylingService;
    }
    
    /// <summary>
    /// Requests the CSS of the current system (customer).
    /// </summary>
    /// <returns>A CSS string that reflects the styling of the current system.</returns>
    [HttpGet]
    [Route("system-styling")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetSystemStyling()
    {
        return (await stylingService.GetSystemStylingAsync((ClaimsIdentity)User.Identity)).GetHttpResponseMessage();
    }
}