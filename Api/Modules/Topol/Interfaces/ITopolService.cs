using System.IO;
using System.Security.Claims;
using System.Threading.Tasks;
using Api.Modules.Topol.Models;
using Microsoft.AspNetCore.Http;

namespace Api.Modules.Topol.Interfaces;

public interface ITopolService
{
    public Task<TopolTemplate> GetTemplate(string encryptedId, ClaimsIdentity identity);
    
    public Task<Image[]> GetFolders(string path, string identifier, string baseUrl, string subDomain);

    public Task<string[]> InsertFolder(string name, string path, string identifier);

    public Task<int> DeleteImagesOrFolders(ImageDeleteModel[] models, string identifier);

    public Task<string> UploadImage(IFormFile image, string path, string identifier);

    public Task SendTestMail(string email, string html);
}