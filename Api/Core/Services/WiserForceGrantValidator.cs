using System;
using System.Collections.Generic;
using System.Net;
using System.Security.Claims;
using System.Threading.Tasks;
using Api.Core.Models;
using Api.Modules.Tenants.Interfaces;
using Api.Modules.Tenants.Models;
using Duende.IdentityModel;
using Duende.IdentityServer.Models;
using Duende.IdentityServer.Validation;
using GeeksCoreLibrary.Core.Extensions;
using GeeksCoreLibrary.Core.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace Api.Core.Services;

/// <summary>
/// Identity validator that utilizes an imitation protocol to force users to login based on a given encrypted user ID.
/// </summary>
public class WiserForceGrantValidator : IExtensionGrantValidator
{
    private readonly IUsersService usersService;
    private readonly GclSettings gclSettings;
    private readonly IHttpContextAccessor httpContextAccessor;
    private readonly IWiserTenantsService wiserTenantsService;
    
    /// <summary>
    /// Constructor for the <see cref="WiserForceGrantValidator"/> class.
    /// </summary>
    public WiserForceGrantValidator(
        IUsersService usersService,
        IOptions<GclSettings> gclSettings,
        IHttpContextAccessor httpContextAccessor,
        IWiserTenantsService wiserTenantsService)
    {
        this.usersService = usersService;
        this.gclSettings = gclSettings.Value;
        this.httpContextAccessor = httpContextAccessor;
        this.wiserTenantsService = wiserTenantsService;
    }
    
    /// <inheritdoc/>
    public string GrantType => "force_login";
    
    /// <inheritdoc/>
    public async Task ValidateAsync(ExtensionGrantValidationContext context)
    {
        string encryptedUserId = context.Request.Raw.Get("token");
        string isTestEnvironment = context.Request.Raw[HttpContextConstants.IsTestEnvironmentKey];
        
        string isWiserFrontEndLoginEncrypted = context.Request.Raw[HttpContextConstants.IsWiserFrontEndLoginKey];
        bool isWiserFrontEndLogin = false;
        if (!string.IsNullOrWhiteSpace(isWiserFrontEndLoginEncrypted))
        {
            isWiserFrontEndLoginEncrypted = WebUtility.HtmlDecode(isWiserFrontEndLoginEncrypted);
            isWiserFrontEndLogin = isWiserFrontEndLoginEncrypted.DecryptWithAesWithSalt(gclSettings.DefaultEncryptionKey, false, 0, true).Equals("true", StringComparison.OrdinalIgnoreCase);
        }

        if (string.IsNullOrWhiteSpace(encryptedUserId))
        {
            context.Result = new GrantValidationResult(
                TokenRequestErrors.InvalidGrant,
                "No token supplied"
            );
            return;
        }
        
        ClaimsIdentity identity = httpContextAccessor.HttpContext?.User.Identity as ClaimsIdentity;
        ulong userId = await wiserTenantsService.DecryptValue<ulong>(encryptedUserId, identity);

        string subDomain = context.Request.Raw[HttpContextConstants.SubDomainKey];

        ServiceResult<UserModel> userResult = await usersService.GetUserByIdAsync(userId);

        if (userResult.StatusCode != HttpStatusCode.OK)
        {
            context.Result = new GrantValidationResult(
                TokenRequestErrors.InvalidGrant,
                "User not found"
            );
            return;
        }

        UserModel user = userResult.ModelObject;
        
        // TODO: How do we determine whether this is an admin account at this point?
        ulong adminAccountId = 0;
        
        Dictionary<string, object> customResponse = new Dictionary<string, object>
        {
            { "adminLogin", adminAccountId > 0 },
            { "name", user.Name },
            { "role", user.Role },
            { "lastLoginIpAddress", user.LastLoginIpAddress },
            { "lastLoginDate", (user.LastLoginDate ?? DateTime.Now).ToString("dd-MM-yyyy HH:mm:ss") },
            { "oldStyleUserId", user.Id.ToString().EncryptWithAesWithSalt() },
            { "cookieValue", user.CookieValue },
            { "encryptedLoginLogId", user.EncryptedLoginLogId },
            { "totpEnabled", user.TotpAuthentication.Enabled },
            { "totpQrImageUrl", user.TotpAuthentication.QrImageUrl },
            { "totpSuccess", true },
            { "totpFirstTime", adminAccountId == 0 && user.TotpAuthentication.RequiresSetup }
        };
        
        context.Result = new GrantValidationResult(
            user.Id.ToString(),
            OidcConstants.AuthenticationMethods.Password,
            CreateClaims(user, subDomain, isTestEnvironment, isWiserFrontEndLogin),
            customResponse: customResponse
        );
    }

    private IEnumerable<Claim> CreateClaims(UserModel user, string subDomain, string isTestEnvironment, bool isWiserFrontEndLogin)
    {
        return new List<Claim>
        {
            new(ClaimTypes.GivenName, user.Name),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Username),
            new(ClaimTypes.Role, IdentityConstants.AdminAccountRole),
            new(ClaimTypes.GroupSid, subDomain),
            new(HttpContextConstants.IsTestEnvironmentKey, isTestEnvironment),
            new(HttpContextConstants.IsWiserFrontEndLoginKey, isWiserFrontEndLogin.ToString())
        };
    }
}