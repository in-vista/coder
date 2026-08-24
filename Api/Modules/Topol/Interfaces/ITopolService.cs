using System.Security.Claims;
using System.Threading.Tasks;
using Api.Modules.Topol.Models;
using Microsoft.AspNetCore.Http;

namespace Api.Modules.Topol.Interfaces;

/// <summary>
/// A service class to handle all processes related to Topol.
/// </summary>
public interface ITopolService
{
    /// <summary>
    /// Fetches Topol template information based on the given encrypted ID of the template.
    /// </summary>
    /// <param name="encryptedId">The encrypted ID of the template to retrieve.</param>
    /// <param name="identity">The <see cref="ClaimsIdentity"/> instance of the authenticated user for the current request.</param>
    /// <returns>A <see cref="TopolTemplate"/> instance containing all necessary information about the template.</returns>
    public Task<TopolTemplate> GetTemplate(string encryptedId, ClaimsIdentity identity);
    
    /// <summary>
    /// Fetches information on the directory structure of the given identifier (user ID).
    /// </summary>
    /// <param name="path">The path to retrieve the directory structure for.</param>
    /// <param name="identifier">The user ID which is bound to the directory structure.</param>
    /// <param name="baseUrl">The base URL to adhere for generating absolute URLs of the images.</param>
    /// <param name="subDomain">The subdomain to adhere for generating absolute URLs of the images.</param>
    /// <returns>A collection of <see cref="Image"/> instances that define the content of the given folder.</returns>
    public Task<Image[]> GetFolders(string path, string identifier, string baseUrl, string subDomain);
    
    /// <summary>
    /// Creates a new directory in the directory structure of the custom Topol file system.
    /// </summary>
    /// <param name="name">The name of the folder to insert.</param>
    /// <param name="path">The relative path leading to this folder.</param>
    /// <param name="identifier">The user ID which is bound to the directory structure.</param>
    /// <returns>The path leading to the newly created folder.</returns>
    public Task<string[]> InsertFolder(string name, string path, string identifier);
    
    /// <summary>
    /// Deletes a directory from the directory structure of the custom Topol file system.
    /// </summary>
    /// <param name="models">A collection of <see cref="ImageDeleteModel"/> instances that define what files to delete.</param>
    /// <param name="identifier">The user ID which is bound to the directory structure.</param>
    /// <returns>The amount of successfully deleted images and/or folders.</returns>
    public Task<int> DeleteImagesOrFolders(ImageDeleteModel[] models, string identifier);
    
    /// <summary>
    /// Uploads a new image to the custom Topol file system.
    /// </summary>
    /// <param name="image">The file to be uploaded from the HTTP form request.</param>
    /// <param name="path">The path leading to the folder the image is to be uploaded in.</param>
    /// <param name="identifier">A unique identifier for the image to be identified by the custom Topol file system.</param>
    /// <returns>The absolute URL that identifies the uploaded image.</returns>
    public Task<string> UploadImage(IFormFile image, string path, string identifier);
    
    /// <summary>
    /// Sends a test mail through Coder's mail system for the given information.
    /// </summary>
    /// <param name="email">The e-mail of the recipient.</param>
    /// <param name="html">The HTML content of the e-mail to send.</param>
    public Task SendTestMail(string email, string html);
}