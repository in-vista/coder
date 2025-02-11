using System;
using Newtonsoft.Json;

namespace Api.Modules.Topol.Utility;

public class BoolToIntConverter : JsonConverter<bool>
{
    public override void WriteJson(JsonWriter writer, bool value, JsonSerializer serializer)
    {
        writer.WriteValue(value ? 1 : 0);
    }

    public override bool ReadJson(JsonReader reader, Type objectType, bool existingValue, bool hasExistingValue, JsonSerializer serializer)
    {
        return Convert.ToInt32(reader.Value) == 1;
    }
}