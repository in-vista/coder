using System;
using Api.Modules.Topol.Enums;

namespace Api.Modules.Topol.Models;

public class Image
{
    public string Name { get; set; }
    
    public DateTime Date { get; set; }
    
    public uint Size { get; set; }
    
    public string Path { get; set; }
    
    public FileType Type { get; set; }
    
    public string Extension { get; set; }
    
    public string Url { get; set; }
}