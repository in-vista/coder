using System.Threading.Tasks;

namespace Api.Modules.CloudFlare.Interfaces
{
    /// <summary>
    /// Serice for handling CloudFlare services (images)
    /// </summary>
    public interface ICloudFlareService
    {
        /// <summary>
        /// Download a file from CloudFlare's R2 object storage
        /// </summary>
        /// <param name="bucketName">The name of the R2 bucket to download the file from, for example <c>coder-imports</c>.</param>
        /// <param name="objectKey">The path to the file or folder to download.</param>
        /// <returns></returns>
        Task<byte[]> DownloadFileAsync(string bucketName, string objectKey);
        
        /// <summary>
        /// Uploads an image to CloudFlare
        /// </summary>
        /// <param name="fileName">Name of the file to upload.</param>
        /// <param name="fileBytes">Contents of the file to upload.</param>
        /// <returns>string with url from CloudFlare</returns>
        Task<string> UploadImageAsync(string fileName, byte[] fileBytes, string useVariant);

        /// <summary>
        /// Uploads a file to Cloudflare R2 object storage and returns the object key when the upload succeeds.
        /// </summary>
        /// <param name="fileName">
        /// The name of the file to upload, including its extension.
        /// </param>
        /// <param name="fileBytes">
        /// The raw bytes of the file to upload.
        /// </param>
        /// <param name="bucketName">
        /// The name of the R2 bucket to upload the file to, for example <c>coder-imports</c>.
        /// </param>
        /// <param name="contentType">
        /// The MIME type of the file, for example <c>application/zip</c> or <c>image/png</c>.
        /// If no value is provided, <c>application/octet-stream</c> is used.
        /// </param>
        /// <param name="folder">
        /// An optional folder path inside the bucket. If provided, the uploaded file will be stored under that path.
        /// </param>
        /// <returns>
        /// The uploaded object's key when the upload succeeds; otherwise an empty string.
        /// </returns>
        Task<string> UploadFileAsync(string fileName, byte[] fileBytes, string bucketName, string contentType = null, string folder = null);

        /// <summary>
        /// Deletes an image based on the image id encapsulated in the url
        /// </summary>
        /// <param name="url">Url from Cloudflare</param>
        /// <returns></returns>
        Task DeleteImageAsync(string url);

        /// <summary>
        /// Delete a file or folder from CloudFlare's R2 object storage
        /// </summary>
        /// <param name="bucketName">The name of the R2 bucket to delete the file from, for example <c>coder-imports</c>.</param>
        /// <param name="objectKey">The path to the file or folder to delete.</param>
        /// <returns></returns>
        Task<bool> DeleteFileAsync(string bucketName, string objectKey);

    }
}
