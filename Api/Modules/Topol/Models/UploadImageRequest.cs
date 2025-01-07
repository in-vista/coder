using System.IO;
using Microsoft.AspNetCore.Http;

namespace Api.Modules.Topol.Models;

public class UploadImageRequest
{
    public IFormFile Image { get; set; }
    
    public string Path { get; set; }
    
    public string Uuid { get; set; }
}