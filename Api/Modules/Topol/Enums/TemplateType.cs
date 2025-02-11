using System.Runtime.Serialization;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

namespace Api.Modules.Topol.Models;

[JsonConverter(typeof(StringEnumConverter))]
public enum TemplateType
{
    [EnumMember(Value = "FREE")]
    Free,
    [EnumMember(Value = "PRO")]
    Pro
}