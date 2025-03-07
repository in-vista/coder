using System.Threading.Tasks;
using Api.Core.Services;
using Api.Modules.GeoLocation.Models;

namespace Api.Modules.GeoLocation.Interfaces;

public interface IGeoLocationService
{
    public Task<ServiceResult<Pro6PPAddress>> GetPro6PPAddress(string zipCode, int? houseNumber, string premise);
}