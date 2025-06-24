using System.Security.Claims;
using System.Threading.Tasks;
using Api.Core.Services;

namespace Api.Modules.Styling.Interfaces;

public interface IStylingService
{
    /// <summary>
    /// Retrieves both the system styling and styling based on a query. Both of these settings are set up as
    /// system objects, where the former (with key <c>styling</c>) represents a CSS string, while the latter
    /// (with key <c>styling_query</c>) represents a query ID where its results represent a CSS string.
    /// </summary>
    /// <param name="identity">The identity of the logged in user.</param>
    /// <returns>A CSS string representing the styling of the current system.</returns>
    public Task<ServiceResult<string>> GetSystemStylingAsync(ClaimsIdentity identity);
}