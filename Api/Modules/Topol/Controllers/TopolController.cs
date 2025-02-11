using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Api.Core.Helpers;
using Api.Modules.Topol.Interfaces;
using Api.Modules.Topol.Models;
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
        Image[] images = await topolService.GetFoldersAsync(path, identifier, baseUrl, subDomain);
        return new JsonResult(images);
    }

    [HttpPost("folders")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> InsertFolder([FromBody] InsertFolderRequest request, [FromQuery(Name = "userId")] string identifier)
    {
        string[] urls = await topolService.InsertFolderAsync(request.Name, request.Path, identifier);
        
        InsertFolderUrl[] insertFolderUrls = urls.Select(url => new InsertFolderUrl { Url = url }).ToArray();
        InsertFolderResponse response = new InsertFolderResponse { Urls = insertFolderUrls };
        
        return new JsonResult(response);
    }

    [HttpPost("folders/delete")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> DeleteImagesOrFolders([FromBody] ImageDeleteModel[] models, [FromQuery(Name = "userId")] string identifier)
    {
        await topolService.DeleteImagesOrFoldersAsync(models, identifier);
        return Ok();
    }

    [HttpPost("image-upload")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> UploadImage([FromForm] UploadImageRequest request)
    {
        string fileUrl = await topolService.UploadImageAsync(request.Image, request.Path, request.Uuid);
        
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

    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates(
        [FromQuery] string queryId,
        [FromQuery] string countQueryId,
        [FromQuery(Name = "sort_by")] string sortBy,
        [FromQuery(Name = "sort_by_direction")] string sortByDirection,
        [FromQuery] string search,
        [FromQuery(Name = "current_page")] int currentPage = 1
    ) {
        PreMadeTopolTemplatesResult result = await topolService.GetTemplatesAsync(queryId, countQueryId, currentPage, search, sortBy, sortByDirection, (ClaimsIdentity) User.Identity);
        return new JsonResult(new
        {
            success = true,
            data = result
        });
    }

    [HttpGet("templates/{id}")]
    public async Task<IActionResult> GetTemplate(int id)
    {
        PreMadeTopolTemplate template = await topolService.GetTemplateAsync(id);
        return new JsonResult(new
        {
            success = true,
            data = template
        });
    }

    [HttpGet("template-categories")]
    public async Task<IActionResult> GetTemplateCategories()
    {
        TopolCategory[] categories = await topolService.GetTemplateCategoriesAsync();
        return new JsonResult(new
        {
            success = true,
            data = categories
        });
    }

    [HttpGet("template-keywords")]
    public async Task<IActionResult> GetTemplateKeywords()
    {
        TopolKeyword[] keywords = await topolService.GetTemplateKeywordsAsync();
        return new JsonResult(new
        {
            success = true,
            data = keywords
        });
    }

    [HttpPost("send-test-mail")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> SendTestMail(SendTestMailRequest request)
    {
        await topolService.SendTestMailAsync(request.Email, request.Html);
        return Ok();
    }
}