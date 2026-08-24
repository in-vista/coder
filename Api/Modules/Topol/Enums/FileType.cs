using System.Runtime.Serialization;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

namespace Api.Modules.Topol.Enums;

/// <summary>
/// An enumeration defining the type of entity in the Topol file system.
/// </summary>
[JsonConverter(typeof(StringEnumConverter))]
public enum FileType
{
    /// <summary>
    /// File definition.
    /// </summary>
    [EnumMember(Value = "file")]
    File,
    /// <summary>
    /// Folder definition.
    /// </summary>
    [EnumMember(Value = "folder")]
    Folder
}