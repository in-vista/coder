using System.Threading.Tasks;
using Api.Core.Services;
using Api.Modules.GeoLocation.Models;

namespace Api.Modules.GeoLocation.Interfaces;

public interface IGeoLocationService
{
    /// <summary>
    /// Fetches all address information based on the partially given information of an address.
    /// </summary>
    /// <param name="zipCode">The Zipcode/Postalcode of the address.</param>
    /// <param name="houseNumber">The house number of the address.</param>
    /// <param name="premise">The house number addition of the address.</param>
    /// <returns>A <see cref="Pro6PPAddress"/> model containing all the address information that was requested.</returns>
    public Task<ServiceResult<Pro6PPAddress>> GetPro6PPAddress(string zipCode, int? houseNumber, string premise);
}