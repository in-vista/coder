 namespace Api.Modules.ImportExport.Models
 {
     /// <summary>
     /// 
     /// </summary>
     public class ChunkMetaDataModel
     {
         /// <summary>
         /// Gets or sets the upload ID
         /// </summary>
         public string UploadUid { get; set; }
         /// <summary>
         /// Gets or sets the file name
         /// </summary>
         public string FileName { get; set; }
         /// <summary>
         /// Gets or sets the content type
         /// </summary>
         public string ContentType;
         /// <summary>
         /// Gets or sets the chunk index
         /// </summary>
         public long ChunkIndex;
         /// <summary>
         /// Gets or sets the total chunks
         /// </summary>
         public long TotalChunks;
         /// <summary>
         /// Gets or sets the total file size
         /// </summary>
         public long TotalFileSize;
     }
 }