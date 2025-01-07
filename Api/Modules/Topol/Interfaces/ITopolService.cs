using System.IO;
using System.Threading.Tasks;
using Api.Modules.Topol.Models;
using Microsoft.AspNetCore.Http;

namespace Api.Modules.Topol.Interfaces;

public interface ITopolService
{
    public Task<Image[]> GetFolders(string path, string identifier, string baseUrl, string subDomain);

    public Task<string[]> InsertFolder(string name, string path, string identifier);

    public Task<int> DeleteImagesOrFolders(ImageDeleteModel[] models, string identifier);

    public Task<string> UploadImage(IFormFile image, string path, string identifier);
}