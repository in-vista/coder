using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Api.Core.Models;
using Api.Core.Services;
using GeeksCoreLibrary.Modules.Communication.Interfaces;
using Api.Modules.Pusher.Interfaces;
using Api.Modules.Pusher.Models;
using FluentFTP.Helpers;
using GeeksCoreLibrary.Modules.Templates.Interfaces;
using GeeksCoreLibrary.Core.DependencyInjection.Interfaces;
using GeeksCoreLibrary.Core.Extensions;
using GeeksCoreLibrary.Core.Interfaces;
using GeeksCoreLibrary.Modules.Communication.Models;
using Microsoft.Extensions.Options;
using PusherServer;

namespace Api.Modules.Pusher.Services
{
    //TODO Verify comments
    /// <summary>
    /// Service for handling messages between users within Wiser.
    /// </summary>
    public class PusherService : IPusherService, IScopedService
    {
        private readonly ApiSettings apiSettings;
        private readonly ITemplatesService templatesService;
        private readonly ICommunicationsService communicationsService;
        private readonly IWiserItemsService wiserItemsService;

        /// <summary>
        /// Creates a new instance of <see cref="PusherService"/>.
        /// </summary>
        /// <param name="apiSettings"></param>
        /// <param name="templatesService"></param>
        /// <param name="communicationsService"></param>
        /// <param name="wiserItemsService"></param>
        public PusherService(
            IOptions<ApiSettings> apiSettings,
            ITemplatesService templatesService,
            ICommunicationsService communicationsService,
            IWiserItemsService wiserItemsService)
        {
            this.apiSettings = apiSettings.Value;
            this.templatesService = templatesService;
            this.communicationsService = communicationsService;
            this.wiserItemsService = wiserItemsService;
        }

        /// <inheritdoc />
        public ServiceResult<string> GeneratePusherIdForUser(ulong userId, string subDomain)
        {
            if (userId == 0)
            {
                return new ServiceResult<string>
                {
                    StatusCode = HttpStatusCode.BadRequest,
                    ErrorMessage = "UserId must be greater than 0"
                };
            }

            var eventId = $"{subDomain}_{userId}";
            var hash = eventId.ToSha512ForPasswords(Encoding.UTF8.GetBytes(apiSettings.PusherSalt));
            return new ServiceResult<string>(hash);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<bool>> SendMessageToUserAsync(string subDomain, PusherMessageRequestModel data)
        {
            if (string.IsNullOrEmpty(apiSettings.PusherSalt))
                return new ServiceResult<bool>(false)
                {
                    StatusCode = HttpStatusCode.BadRequest,
                    ErrorMessage = "PusherSalt must be provided in the app settings"
                };
            
            if (data == null || (data.UserId == 0 && !data.IsGlobalMessage))
            {
                return new ServiceResult<bool>(false)
                {
                    StatusCode = HttpStatusCode.BadRequest,
                    ErrorMessage = "UserId must be greater than 0"
                };
            }

            if (String.IsNullOrWhiteSpace(data.Channel))
            {
                data.Channel = "Wiser";
            }

            if (data.EventData == null)
            {
                data.EventData = new { message = "new" };
            }
            
            if (String.IsNullOrWhiteSpace(data.Cluster))
            {
                data.Cluster = "eu";
            }
            
            var pusherId = GeneratePusherIdForUser(data.UserId, subDomain).ModelObject;
            var options = new PusherOptions
            {
                Cluster = data.Cluster,
                Encrypted = true
            };
            
            // Global messages do not fire events for a specific user.
            var eventName = !String.IsNullOrWhiteSpace(data.EventName) ? data.EventName : data.IsGlobalMessage ? data.Channel : $"{data.Channel}_{pusherId}";

            var pusher = new PusherServer.Pusher(apiSettings.PusherAppId, apiSettings.PusherAppKey, apiSettings.PusherAppSecret, options);
            var result = await pusher.TriggerAsync(data.Channel, eventName, data.EventData);
            var success = (int)result.StatusCode >= 200 && (int)result.StatusCode < 300;
            
            // TODO: Make it so that it doesn't use skipPermissionsCheck
            var userDetails = await wiserItemsService.GetItemDetailsAsync(data.UserId, skipPermissionsCheck: true);
            
            var emailAddress = userDetails.GetDetailValue("email_address");
            
            var serviceResult = new ServiceResult<bool>(success)
            {
                StatusCode = result.StatusCode,
                ErrorMessage = success ? null : result.Body
            };
            if (!data.SendEmail || String.IsNullOrWhiteSpace(emailAddress))
                return serviceResult;
            
            var dict = JsonSerializer.Deserialize<Dictionary<string, string>>(data.EventData.ToString());
            
            await communicationsService.SendEmailAsync(receiverName: userDetails.Title, receiver: emailAddress, subject: "Agendering vanuit Coder",  body: dict.FirstOrDefault().Value);

            return serviceResult;
        }
    }
}
