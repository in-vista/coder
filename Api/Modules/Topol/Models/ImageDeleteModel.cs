using Api.Modules.Topol.Enums;

namespace Api.Modules.Topol.Models;

public class ImageDeleteModel
{
    public string Name { get; set; }
    
    public FileType Type { get; set; }
    
    public string Path { get; set; }
}