using System.Data;
using System.Security.Claims;
using System.Threading.Tasks;
using Api.Core.Interfaces;
using Api.Core.Services;
using Api.Modules.Styling.Interfaces;
using GeeksCoreLibrary.Core.DependencyInjection.Interfaces;
using GeeksCoreLibrary.Core.Models;
using GeeksCoreLibrary.Modules.Databases.Interfaces;
using GeeksCoreLibrary.Modules.GclReplacements.Interfaces;
using GeeksCoreLibrary.Modules.Objects.Interfaces;

namespace Api.Modules.Styling.Services;

public class StylingService : IStylingService, IScopedService
{
    private readonly IObjectsService objectsService;
    
    private readonly IApiReplacementsService apiReplacementsService;
    
    private readonly IStringReplacementsService stringReplacementsService;
    
    private readonly IDatabaseConnection databaseConnection;

    public StylingService(
        IObjectsService objectsService,
        IApiReplacementsService apiReplacementsService,
        IStringReplacementsService stringReplacementsService,
        IDatabaseConnection databaseConnection)
    {
        this.objectsService = objectsService;
        this.apiReplacementsService = apiReplacementsService;
        this.stringReplacementsService = stringReplacementsService;
        this.databaseConnection = databaseConnection;
    }
    
    /// <summary>
    /// <inheritdoc cref="IStylingService.GetSystemStylingAsync"/>
    /// </summary>
    /// <param name="identity"><inheritdoc cref="IStylingService.GetSystemStylingAsync"/></param>
    /// <returns><inheritdoc cref="IStylingService.GetSystemStylingAsync"/></returns>
    public async Task<ServiceResult<string>> GetSystemStylingAsync(ClaimsIdentity identity)
    {
        // Retrieve the CSS of the system based on the system object.
        string systemStyling = await objectsService.FindSystemObjectByDomainNameAsync("styling");
        
        // Retrieve the query ID for the styling of the current system and prepare an empty result.
        string systemStylingQueryId = await objectsService.FindSystemObjectByDomainNameAsync("styling_query");
        string systemStylingByQuery = null;
        
        // Check whether a query ID is set for the system styling.
        if (!string.IsNullOrEmpty(systemStylingQueryId))
        {
            // Prepare and run a query to retrieve the query for retrieving the system styling.
            databaseConnection.AddParameter("id", systemStylingQueryId);
            DataTable systemStylingQueryResults = await databaseConnection.GetAsync($"SELECT query FROM `{WiserTableNames.WiserQuery}` WHERE id = ?id");
            
            // Retrieve the system styling query.
            string systemStylingQuery = systemStylingQueryResults.Rows.Count > 0
                ? systemStylingQueryResults.Rows[0].Field<string>("query")
                : null;
            
            // Check whether a query was found.
            if (!string.IsNullOrEmpty(systemStylingQuery))
            {
                // Perform HTTP and identity replacements on the system styling query.
                systemStylingQuery = apiReplacementsService.DoIdentityReplacements(systemStylingQuery, identity);
                systemStylingQuery = stringReplacementsService.DoHttpRequestReplacements(systemStylingQuery, true);
                
                // Run the query for retrieving the system styling and retrieve its results.
                DataTable systemStylingResults = await databaseConnection.GetAsync(systemStylingQuery);
                
                // Retrieve the CSS string for the system styling by query.
                systemStylingByQuery = systemStylingResults.Rows.Count > 0
                    ? systemStylingResults.Rows[0][0] as string
                    : null;
            }
        }
        
        // Combine the system styling directly from the system objects and system styling by query into one string.
        string combinedStyling = string.Join("\n", systemStyling, systemStylingByQuery);
        
        // Return the CSS string representing the system styling.
        return new ServiceResult<string>(combinedStyling);
    }
}