using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Api.Core.Helpers;
using Api.Modules.Topol.Interfaces;
using Api.Modules.Topol.Models;
using Microsoft.AspNetCore.Mvc;

namespace Api.Modules.Topol.Controllers;

/// <summary>
/// The controller to handle all processes for the Topol template system.
/// </summary>
[Route("api/v3/topol")]
[ApiController]
public class TopolController : ControllerBase
{
    /// <summary>
    /// <inheritdoc cref="ITopolService"/>
    /// </summary>
    private readonly ITopolService topolService;

    /// <summary>
    /// The constructor the Topol controller class.
    /// </summary>
    /// <param name="topolService"></param>
    public TopolController(ITopolService topolService)
    {
        this.topolService = topolService;
    }
    
    /// <summary>
    /// Fetches Topol template information based on the given encrypted ID of the template.
    /// </summary>
    /// <param name="encryptedId">The encrypted ID of the template to retrieve.</param>
    /// <returns>A JSON object containing all necessary information about the template.</returns>
    [HttpGet("{encryptedId}")]
    public async Task<IActionResult> GetTemplate(string encryptedId)
    {
        TopolTemplate template = await topolService.GetTemplate(encryptedId, User.Identity as ClaimsIdentity);
        return new JsonResult(template);
    }
    
    /// <summary>
    /// Fetches information on the directory structure of the given identifier (user ID).
    /// </summary>
    /// <param name="path">The path to retrieve the directory structure for.</param>
    /// <param name="identifier">The user ID which is bound to the directory structure.</param>
    /// <returns>A JSON array containing the directory structure of the given path.</returns>
    [HttpGet("folders")]
    public async Task<IActionResult> GetFolders([FromQuery] string path, [FromQuery(Name = "userId")] string identifier)
    {
        // TODO: Retrieve the base URL and subdomain through the HttpContextAccessor in the service.
        string baseUrl = $"{HttpContext.Request.Scheme}://{HttpContext.Request.Host}";
        string subDomain = IdentityHelpers.GetSubDomain(User.Identity as ClaimsIdentity);
        Image[] images = await topolService.GetFolders(path, identifier, baseUrl, subDomain);
        return new JsonResult(images);
    }
    
    /// <summary>
    /// Creates a new directory in the directory structure of the custom Topol file system.
    /// </summary>
    /// <param name="request">The <see cref="InsertFolderRequest"/> request model containing information to process the request.</param>
    /// <param name="identifier">The user ID which is bound to the directory structure.</param>
    /// <returns>A JSON object containing information of the newly created directory.</returns>
    [HttpPost("folders")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> InsertFolder([FromBody] InsertFolderRequest request, [FromQuery(Name = "userId")] string identifier)
    {
        string[] urls = await topolService.InsertFolder(request.Name, request.Path, identifier);
        
        InsertFolderUrl[] insertFolderUrls = urls.Select(url => new InsertFolderUrl { Url = url }).ToArray();
        InsertFolderResponse response = new InsertFolderResponse { Urls = insertFolderUrls };
        
        return new JsonResult(response);
    }
    
    /// <summary>
    /// Deletes a directory from the directory structure of the custom Topol file system.
    /// </summary>
    /// <param name="models">A collection of <see cref="ImageDeleteModel"/> instances that define what files to delete.</param>
    /// <param name="identifier">The user ID which is bound to the directory structure.</param>
    /// <returns>A 200 OK if the files were successfully deleted.</returns>
    [HttpPost("folders/delete")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> DeleteImagesOrFolders([FromBody] ImageDeleteModel[] models, [FromQuery(Name = "userId")] string identifier)
    {
        await topolService.DeleteImagesOrFolders(models, identifier);
        return Ok();
    }
    
    /// <summary>
    /// Uploads a new image to the custom Topol file system.
    /// </summary>
    /// <param name="request">The <see cref="UploadImageRequest"/> request model containing information on the uploaded file to process.</param>
    /// <returns>A compact JSON object containing the success/failed state of the image upload.</returns>
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
    
    /// <summary>
    /// Sends a test mail through Coder's mail system for the given information.
    /// </summary>
    /// <param name="request">The <see cref="SendTestMailRequest"/> request containing information on what content to send to what recipient.</param>
    /// <returns>A 200 OK if the mail was successfully sent to the recipient.</returns>
    [HttpPost("send-test-mail")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> SendTestMail(SendTestMailRequest request)
    {
        await topolService.SendTestMail(request.Email, request.Html);
        return Ok();
    }
}