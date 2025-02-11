using System.Security.Claims;
using System.Threading.Tasks;
using Api.Modules.Topol.Models;
using Microsoft.AspNetCore.Http;

namespace Api.Modules.Topol.Interfaces;

public interface ITopolService
{
    public Task<Image[]> GetFoldersAsync(string path, string identifier, string baseUrl, string subDomain);

    public Task<string[]> InsertFolderAsync(string name, string path, string identifier);

    public Task<int> DeleteImagesOrFoldersAsync(ImageDeleteModel[] models, string identifier);

    public Task<string> UploadImageAsync(IFormFile image, string path, string identifier);

    public Task<PreMadeTopolTemplatesResult> GetTemplatesAsync(string queryId, string countQueryId, int currentPage, string search, string sortBy, string sortByDirection, ClaimsIdentity identity);
    
    public Task<PreMadeTopolTemplate> GetTemplateAsync(int id);

    public Task<TopolCategory[]> GetTemplateCategoriesAsync();
    
    public Task<TopolKeyword[]> GetTemplateKeywordsAsync();

    public Task SendTestMailAsync(string email, string html);
}