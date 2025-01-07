using System.Runtime.Serialization;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

namespace Api.Modules.Topol.Enums;

[JsonConverter(typeof(StringEnumConverter))]
public enum FileType
{
    [EnumMember(Value = "file")]
    File,
    [EnumMember(Value = "folder")]
    Folder
}