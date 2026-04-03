namespace Api.Modules.ImportExport.Models
{
    public class FeedFileUploadResultModel
    {
        public bool Successful { get; set; } = true;
        public string ErrorMessage { get; set; } = "";

        public string[] Columns { get; set; }

        public string Filename { get; set; } = "";

        public uint RowCount { get; set; }

        public uint ImportLimit { get; set; }
        public string Operation { get; set; } = "";
    }
}
