using System.Linq;
using System.Net;
using System.Security.Claims;
using System.Threading.Tasks;
using Api.Core.Helpers;
using Api.Modules.Topol.Interfaces;
using Api.Modules.Topol.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Api.Modules.Topol.Controllers;

[Route("api/v3/topol")]
[ApiController]
public class TopolController : ControllerBase
{
    private readonly ITopolService topolService;

    public TopolController(ITopolService topolService)
    {
        this.topolService = topolService;
    }

    [HttpGet("folders")]
    public async Task<IActionResult> GetFolders([FromQuery] string path, [FromQuery(Name = "userId")] string identifier)
    {
        string baseUrl = $"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}";
        string subDomain = IdentityHelpers.GetSubDomain(User.Identity as ClaimsIdentity);
        Image[] images = await topolService.GetFolders(path, identifier, baseUrl, subDomain);
        return new JsonResult(images);
    }

    [HttpPost("folders")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> InsertFolder([FromBody] InsertFolderRequest request, [FromQuery(Name = "userId")] string identifier)
    {
        string[] urls = await topolService.InsertFolder(request.Name, request.Path, identifier);
        
        InsertFolderUrl[] insertFolderUrls = urls.Select(url => new InsertFolderUrl { Url = url }).ToArray();
        InsertFolderResponse response = new InsertFolderResponse { Urls = insertFolderUrls };
        
        return new JsonResult(response);
    }

    [HttpPost("folders/delete")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> DeleteImagesOrFolders([FromBody] ImageDeleteModel[] models, [FromQuery(Name = "userId")] string identifier)
    {
        await topolService.DeleteImagesOrFolders(models, identifier);
        return Ok();
    }

    [HttpPost("image-upload")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> UploadImage([FromForm] UploadImageRequest request)
    {
        string fileUrl = await topolService.UploadImage(request.Image, request.Path, request.Uuid);
        
        if (string.IsNullOrEmpty(fileUrl))
            return new JsonResult(new
            {
                success = false,
                url = string.Empty
            });
        
        string subDomain = IdentityHelpers.GetSubDomain(User.Identity as ClaimsIdentity);
        fileUrl += $"&subDomain={subDomain}";
        fileUrl = $"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}{fileUrl}";

        return new JsonResult(new
        {
            success = true,
            url = fileUrl
        });
    }
}