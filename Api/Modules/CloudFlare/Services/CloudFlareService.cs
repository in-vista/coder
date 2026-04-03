using Api.Modules.CloudFlare.Models;
using Api.Modules.CloudFlare.Interfaces;
using System.Threading.Tasks;
using GeeksCoreLibrary.Modules.Objects.Interfaces;
using GeeksCoreLibrary.Core.DependencyInjection.Interfaces;
using System;
using System.IO;
using System.Linq;
using Amazon.S3;
using Amazon.S3.Model;
using RestSharp;
using Newtonsoft.Json;

namespace Api.Modules.CloudFlare.Services
{
    /// <inheritdoc cref="ICloudFlareService" />
    public class CloudFlareService : ICloudFlareService, IScopedService
    {
        private const string ApiPath = "https://api.cloudflare.com/client/v4/accounts/";
        private readonly IObjectsService objectsService;

        /// <summary>
        /// Creates an instance of <see cref="CloudFlareService"/>
        /// </summary>
        public CloudFlareService(IObjectsService objectsService)
        {
            this.objectsService = objectsService;
        }
        /// <summary>
        /// Get the proper settings for CloudFlare communication
        /// </summary>
        /// <returns>A <see cref="CloudFlareSettingsModel"/> with System Object Values</returns>
        private async Task<CloudFlareSettingsModel> GetCloudFlareSettingsAsync()
        {
            var authorizationKey = await objectsService.GetSystemObjectValueAsync("CLOUDFLARE_AuthorizationKey");
            if (String.IsNullOrEmpty(authorizationKey))
            {
                return null;
            }
            return new CloudFlareSettingsModel
            {
                AuthorizationKey = authorizationKey,
                AuthorizationEmail = await objectsService.GetSystemObjectValueAsync("CLOUDFLARE_AuthorizationEmail"),
                AccountId = await objectsService.GetSystemObjectValueAsync("CLOUDFLARE_AccountId"),
                R2AccessKeyId = await objectsService.GetSystemObjectValueAsync("CLOUDFLARE_R2AccessKeyId"),
                R2SecretAccessKey = await objectsService.GetSystemObjectValueAsync("CLOUDFLARE_R2SecretAccessKey")
            };
        }

        /// <inheritdoc cref="ICloudFlareService" />
        public async Task<string> UploadImageAsync(string fileName, byte[] fileBytes, string useVariant)
        {
            var cloudFlareSettings = await GetCloudFlareSettingsAsync();
            var accountId = cloudFlareSettings.AccountId;

            var route = $"{ApiPath}{cloudFlareSettings.AccountId}/images/v1/direct_upload";
            var restClient = new RestClient(route);
            var restRequest = new RestRequest("", Method.Post);
            restRequest.AddHeader("X-Auth-Key", cloudFlareSettings.AuthorizationKey);
            restRequest.AddHeader("X-Auth-Email", cloudFlareSettings.AuthorizationEmail);

            var response = await restClient.ExecuteAsync(restRequest);
            var directUploadResponse = JsonConvert.DeserializeObject<DirectUploadResponseModel>(response.Content);
            if (!directUploadResponse.Success)
            {
                return String.Empty;
            }
            var upLoadUrl = directUploadResponse.Result.UploadURL;
            var uploadClient = new RestClient(upLoadUrl);
            var uploadRequest = new RestRequest("", Method.Post);
            uploadRequest.AddFile("file", fileBytes, fileName);
            var uploadResponse = await uploadClient.ExecuteAsync(uploadRequest);
            var uploadResult = JsonConvert.DeserializeObject<UploadImageResponseModel>(uploadResponse.Content);
            if (!uploadResult.Success)
            {
                return String.Empty;
            }
            return uploadResult.Result.Variants.FirstOrDefault(url => !string.IsNullOrEmpty(useVariant) && url.Contains(useVariant)) ??
                   uploadResult.Result.Variants.First();
        }

        /// <inheritdoc cref="ICloudFlareService" />
        public async Task<string> UploadFileAsync(
            string fileName,
            byte[] fileBytes,
            string bucketName,
            string contentType = null,
            string folder = null)
        {
            try
            {
                // Load the Cloudflare R2 credentials and account settings.
                var cloudFlareSettings = await GetCloudFlareSettingsAsync();

                // Build the object key that will be used inside the bucket.
                // Example:
                // - without folder: "file.zip"
                // - with folder:    "imports/file.zip"
                var objectKey = string.IsNullOrWhiteSpace(folder)
                    ? fileName
                    : $"{folder.TrimEnd('/')}/{fileName}";

                // Configure the AWS S3 client to talk to Cloudflare R2 instead of AWS S3.
                var s3Config = new AmazonS3Config
                {
                    ServiceURL = $"https://{cloudFlareSettings.AccountId}.eu.r2.cloudflarestorage.com",
                    ForcePathStyle = true,
                    SignatureVersion = "4",
                    AuthenticationRegion = "auto"
                };

                using var s3Client = new AmazonS3Client(
                    cloudFlareSettings.R2AccessKeyId,
                    cloudFlareSettings.R2SecretAccessKey,
                    s3Config);

                // Wrap the byte array in a stream so it can be uploaded.
                await using var memoryStream = new MemoryStream(fileBytes);

                var putObjectRequest = new PutObjectRequest
                {
                    BucketName = bucketName,
                    Key = objectKey,
                    InputStream = memoryStream,

                    // Fallback to a generic binary content type if none was provided.
                    ContentType = string.IsNullOrWhiteSpace(contentType)
                        ? "application/octet-stream"
                        : contentType,

                    // These settings are needed for Cloudflare R2 compatibility.
                    DisablePayloadSigning = true,
                    DisableDefaultChecksumValidation = true
                };

                // Upload the file to the bucket.
                var putObjectResponse = await s3Client.PutObjectAsync(putObjectRequest);

                // Return empty if the upload did not succeed.
                if ((int)putObjectResponse.HttpStatusCode < 200 || (int)putObjectResponse.HttpStatusCode >= 300)
                {
                    return string.Empty;
                }

                // Return the object key so it can be stored or used later.
                return objectKey;
            }
            catch
            {
                // Return empty on any failure so the caller can handle fallback logic.
                return string.Empty;
            }
        }
        
        /// <inheritdoc cref="ICloudFlareService"/>
        public async Task<byte[]> DownloadFileAsync(string bucketName, string objectKey)
        {
            try
            {
                var cloudFlareSettings = await GetCloudFlareSettingsAsync();

                var s3Config = new AmazonS3Config
                {
                    ServiceURL = $"https://{cloudFlareSettings.AccountId}.eu.r2.cloudflarestorage.com",
                    ForcePathStyle = true,
                    SignatureVersion = "4",
                    AuthenticationRegion = "auto"
                };

                using var s3Client = new AmazonS3Client(
                    cloudFlareSettings.R2AccessKeyId,
                    cloudFlareSettings.R2SecretAccessKey,
                    s3Config);

                var getObjectRequest = new GetObjectRequest
                {
                    BucketName = bucketName,
                    Key = objectKey
                };

                using var getObjectResponse = await s3Client.GetObjectAsync(getObjectRequest);
                await using var memoryStream = new MemoryStream();
                await getObjectResponse.ResponseStream.CopyToAsync(memoryStream);

                return memoryStream.ToArray();
            }
            catch
            {
                return [];
            }
        }
        
        /// <inheritdoc cref="ICloudFlareService"/>
        public async Task<bool> DeleteFileAsync(string bucketName, string objectKey)
        {
            try
            {
                var cloudFlareSettings = await GetCloudFlareSettingsAsync();

                var s3Config = new AmazonS3Config
                {
                    ServiceURL = $"https://{cloudFlareSettings.AccountId}.eu.r2.cloudflarestorage.com",
                    ForcePathStyle = true,
                    SignatureVersion = "4",
                    AuthenticationRegion = "auto"
                };

                using var s3Client = new AmazonS3Client(
                    cloudFlareSettings.R2AccessKeyId,
                    cloudFlareSettings.R2SecretAccessKey,
                    s3Config);

                var deleteObjectRequest = new DeleteObjectRequest
                {
                    BucketName = bucketName,
                    Key = objectKey
                };

                var deleteObjectResponse = await s3Client.DeleteObjectAsync(deleteObjectRequest);

                return (int)deleteObjectResponse.HttpStatusCode >= 200 &&
                       (int)deleteObjectResponse.HttpStatusCode < 300;
            }
            catch
            {
                return false;
            }
        }

        /// <inheritdoc cref="ICloudFlareService" />
        public async Task DeleteImageAsync(string url)
        {
            var urlParts = url.Split('/');
            var imageId = urlParts[4];
            var cloudFlareSettings = await GetCloudFlareSettingsAsync();
            var accountId = cloudFlareSettings.AccountId;

            var route = $"{ApiPath}{cloudFlareSettings.AccountId}/images/v1/{imageId}";
            var restClient = new RestClient(route);
            var restRequest = new RestRequest("", Method.Delete);
            restRequest.AddHeader("X-Auth-Key", cloudFlareSettings.AuthorizationKey);
            restRequest.AddHeader("X-Auth-Email", cloudFlareSettings.AuthorizationEmail);

            var response = await restClient.ExecuteAsync(restRequest);
        }

    }
}
