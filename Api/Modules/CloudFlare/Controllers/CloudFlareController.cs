using System.Collections.Generic;
using System.IO;
using System.Net.Mime;
using System.Security.Claims;
using System.Threading.Tasks;
using Api.Modules.Branches.Models;
using Api.Modules.CloudFlare.Interfaces;
using Api.Modules.Tenants.Models;
using GeeksCoreLibrary.Modules.Branches.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Api.Modules.CloudFlare.Controllers;

/// <summary>
/// A controller for uploading files to CloudFlare
/// </summary>
[Route("api/v3/cloudflare")]
[ApiController]
[Authorize]
public class CloudFlareController : Controller
{
    private readonly ICloudFlareService cloudFlareService;

    /// <summary>
    /// Creates a new instance of <see cref="CloudFlareController"/>.
    /// </summary>
    public CloudFlareController(ICloudFlareService cloudFlareService)
    {
        this.cloudFlareService = cloudFlareService;
    }
    
    /// <summary>
    /// Uploads a file to Cloudflare R2 object storage.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [Route("r2/upload")]
    public async Task<IActionResult> UploadFileAsync(IFormFile file, string bucketName, string folder = null)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("No file was uploaded.");
        }

        if (string.IsNullOrWhiteSpace(bucketName))
        {
            return BadRequest("Bucket name is required.");
        }

        byte[] fileBytes;
        await using (var memoryStream = new MemoryStream())
        {
            await file.CopyToAsync(memoryStream);
            fileBytes = memoryStream.ToArray();
        }

        var uploadResult = await cloudFlareService.UploadFileAsync(
            file.FileName,
            fileBytes,
            bucketName,
            file.ContentType,
            folder);

        if (string.IsNullOrWhiteSpace(uploadResult))
        {
            return BadRequest("Uploading the file to Cloudflare R2 failed.");
        }

        return Ok(uploadResult);
    }
}
