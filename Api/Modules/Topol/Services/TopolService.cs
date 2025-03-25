using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.IO;
using System.Security.Claims;
using System.Threading.Tasks;
using Api.Core.Interfaces;
using Api.Modules.Tenants.Interfaces;
using Api.Modules.Topol.Enums;
using Api.Modules.Topol.Interfaces;
using Api.Modules.Topol.Models;
using GeeksCoreLibrary.Core.DependencyInjection.Interfaces;
using GeeksCoreLibrary.Core.Exceptions;
using GeeksCoreLibrary.Core.Extensions;
using GeeksCoreLibrary.Core.Interfaces;
using GeeksCoreLibrary.Core.Models;
using GeeksCoreLibrary.Modules.Communication.Interfaces;
using GeeksCoreLibrary.Modules.Databases.Interfaces;
using GeeksCoreLibrary.Modules.GclReplacements.Interfaces;
using Microsoft.AspNetCore.Http;

namespace Api.Modules.Topol.Services;

public class TopolService : ITopolService, IScopedService
{
    private readonly IDatabaseConnection databaseConnection;

    private readonly IWiserTenantsService wiserTenantsService;

    private readonly ICommunicationsService communicationsService;
    
    private readonly IApiReplacementsService apiReplacementsService;
    
    private readonly IStringReplacementsService stringReplacementsService;

    private readonly IWiserItemsService wiserItemsService;

    public TopolService(
	    IDatabaseConnection databaseConnection,
	    IWiserTenantsService wiserTenantsService,
	    ICommunicationsService communicationsService,
	    IApiReplacementsService apiReplacementsService,
	    IStringReplacementsService stringReplacementsService,
	    IWiserItemsService wiserItemsService
	    )
    {
        this.databaseConnection = databaseConnection;
        this.wiserTenantsService = wiserTenantsService;
        this.communicationsService = communicationsService;
        this.apiReplacementsService = apiReplacementsService;
        this.stringReplacementsService = stringReplacementsService;
        this.wiserItemsService = wiserItemsService;
    }
    
    public async Task<Image[]> GetFoldersAsync(string path, string identifier, string baseUrl, string subDomain)
    {
	    // If we are located at the root, check if a root folder already exists. If not, then create one.
	    // Root folders are not a thing in Topol, but we need it to properly store files located on this level in the hierarchy.
	    if (path == "/")
	    {
		    string checkRootDirectoryQuery = @"SELECT 1
FROM wiser_item `directory`
JOIN wiser_itemdetail directory_full_path ON directory_full_path.item_id = `directory`.id AND directory_full_path.`key` = 'full_path'
JOIN wiser_itemdetail directory_context ON directory_context.item_id = `directory`.id AND directory_context.`key` = 'context'
WHERE `directory`.entity_type = 'ImageDirectory' AND directory_full_path.`value` = '/' AND directory_context.`value` = ?identifier";
		    
		    databaseConnection.ClearParameters();
		    databaseConnection.AddParameter("identifier", identifier);
		    
		    DbDataReader checkRootDirectoryReader = await databaseConnection.GetReaderAsync(checkRootDirectoryQuery);
		    bool hasRootDirectory = checkRootDirectoryReader.HasRows;
		    await checkRootDirectoryReader.CloseAsync();

		    if (!hasRootDirectory)
		    {
			    string insertRootDirectoryQuery = @"
INSERT INTO wiser_item (parent_item_id, entity_type, title)
VALUES(?identifier, 'ImageDirectory', '');

SET @directoryId = LAST_INSERT_ID();

    INSERT INTO wiser_itemdetail(item_id, `key`, `value`)
    VALUES
        (@directoryId, 'path', ''),
		(@directoryId, 'full_path', '/'),
        (@directoryId, 'context', ?identifier);";
			    
			    databaseConnection.ClearParameters();
			    databaseConnection.AddParameter("identifier", identifier);
			    await databaseConnection.ExecuteAsync(insertRootDirectoryQuery);
		    }
	    }
	    
	    List<Image> images = new List<Image>();
	    
	    string listFoldersQuery = @"SELECT
	`directory`.title AS `folder_name`,
	`directory`.added_on AS `added_on`,
	directory_path.`value` AS `path`
FROM wiser_item `directory`
JOIN wiser_itemdetail directory_path ON directory_path.item_id = `directory`.id AND directory_path.`key` = 'path'
JOIN wiser_itemdetail directory_context ON directory_context.item_id = `directory`.id AND directory_context.`key` = 'context'
WHERE
	`directory`.entity_type = 'ImageDirectory' AND
	directory_path.`value` = ?path COLLATE utf8mb4_general_ci AND
	directory_context.`value` = ?identifier";
        
	    databaseConnection.ClearParameters();
	    databaseConnection.AddParameter("path", path);
	    databaseConnection.AddParameter("identifier", identifier);
        
	    DbDataReader listFoldersReader = await databaseConnection.GetReaderAsync(listFoldersQuery);
	    while (await listFoldersReader.ReadAsync())
	    {
		    string folderName = listFoldersReader.GetString(listFoldersReader.GetOrdinal("folder_name"));
		    DateTime folderDate = listFoldersReader.GetDateTime(listFoldersReader.GetOrdinal("added_on"));
		    string folderPath = listFoldersReader.GetString(listFoldersReader.GetOrdinal("path"));
		    
		    images.Add(new Image
		    {
			    Name = folderName,
			    Date = folderDate,
			    Extension = string.Empty,
			    Path = folderPath,
			    Size = 0,
			    Type = FileType.Folder,
			    Url = string.Empty
		    });
	    }

	    await listFoldersReader.CloseAsync();
	    
        string listFilesQuery = @"SELECT
	file.file_name AS `file_name`,
	file.added_on AS `added_on`,
	OCTET_LENGTH(file.content) AS `size`,
	?path AS `path`,
	'file' AS `type`,
	file.extension AS `extension`,
	CONCAT('/api/v3/items/', file.item_id, '/files/file/', file.file_name, '?ordering=', file.ordering) AS `url`
FROM wiser_item `directory`
JOIN wiser_itemdetail directory_full_path ON directory_full_path.item_id = `directory`.id AND directory_full_path.`key` = 'full_path'
JOIN wiser_itemdetail directory_context ON directory_context.item_id = `directory`.id AND directory_context.`key` = 'context'
JOIN wiser_itemfile file ON file.item_id = `directory`.id
WHERE
	`directory`.entity_type = 'ImageDirectory' AND
	directory_full_path.`value` = ?path COLLATE utf8mb4_general_ci AND
	directory_context.`value` = ?identifier";
        
        databaseConnection.ClearParameters();
        databaseConnection.AddParameter("path", path);
        databaseConnection.AddParameter("identifier", identifier);

        DbDataReader listFilesReader = await databaseConnection.GetReaderAsync(listFilesQuery);
        while (await listFilesReader.ReadAsync())
        {
	        string relativeUrl = listFilesReader.GetString(listFilesReader.GetOrdinal("url"));
	        string url = $"{baseUrl}{relativeUrl}&subDomain={subDomain}";
	        
	        images.Add(new Image
	        {
		        Name = listFilesReader.GetString(listFilesReader.GetOrdinal("file_name")),
		        Date = listFilesReader.GetDateTime(listFilesReader.GetOrdinal("added_on")),
		        Extension = listFilesReader.GetString(listFilesReader.GetOrdinal("extension")),
		        Path = listFilesReader.GetString(listFilesReader.GetOrdinal("path")),
		        Size = (uint) listFilesReader.GetInt32(listFilesReader.GetOrdinal("size")),
		        Type = FileType.File,
		        Url = url
	        });
        }

        await listFilesReader.CloseAsync();

        return images.ToArray();
    }

    public async Task<string[]> InsertFolderAsync(string name, string path, string identifier)
    {
	    string[] segmentedPath = path.Split("/", StringSplitOptions.RemoveEmptyEntries);
	    string relativePath = segmentedPath.Length > 1 ? $"/{string.Join("/", segmentedPath[1..])}/" : "/";
	    string fullPath = Path.Combine(relativePath, name);
	    if (!string.IsNullOrEmpty(fullPath) && !fullPath.EndsWith("/"))
		    fullPath += "/";
	    
	    string insertFolderQuery = @"
SET @parentDirectoryId = (SELECT
	`directory`.id AS `id`
FROM wiser_item `directory`
JOIN wiser_itemdetail directory_full_path ON directory_full_path.item_id = `directory`.id AND directory_full_path.`key` = 'full_path'
JOIN wiser_itemdetail directory_context ON directory_context.item_id = `directory`.id AND directory_context.`key` = 'context'
WHERE
	`directory`.entity_type = 'ImageDirectory' AND
	directory_full_path.`value` = ?path COLLATE utf8mb4_general_ci AND
	directory_context.`value` = ?identifier
LIMIT 1);
SET @parentDirectoryId = IFNULL(@parentDirectoryId, IF(?fullPath = '', ?identifier, (
	SELECT `directory`.id
	FROM wiser_item `directory`
	JOIN wiser_itemdetail directory_full_path ON directory_full_path.item_id = `directory`.id AND directory_full_path.`key` = 'full_path'
	JOIN wiser_itemdetail directory_context ON directory_context.item_id = `directory`.id AND directory_context.`key` = 'context'
	WHERE `directory`.entity_type = 'ImageDirectory' AND directory_full_path.`value` = '/' AND directory_context.`value` = ?identifier
)));

INSERT INTO wiser_item (parent_item_id, entity_type, title)
VALUES(@parentDirectoryId, 'ImageDirectory', ?title);

SET @directoryId = LAST_INSERT_ID();

    INSERT INTO wiser_itemdetail(item_id, `key`, `value`)
    VALUES
        (@directoryId, 'path', ?path),
		(@directoryId, 'full_path', ?fullPath),
        (@directoryId, 'context', ?identifier);";
	    
	    databaseConnection.ClearParameters();
	    databaseConnection.AddParameter("title", name);
	    databaseConnection.AddParameter("path", relativePath);
	    databaseConnection.AddParameter("fullPath", fullPath);
	    databaseConnection.AddParameter("identifier", identifier);

	    await databaseConnection.ExecuteAsync(insertFolderQuery);

	    return new string[] { Path.Combine(relativePath, name) };
    }

    public async Task<int> DeleteImagesOrFoldersAsync(ImageDeleteModel[] models, string identifier)
    {
	    List<Task> deleteTasks = new List<Task>();

	    int failedDeletions = 0;

	    foreach (ImageDeleteModel model in models)
	    {
		    try
		    {
			    string deleteQuery = string.Empty;

			    switch (model.Type)
			    {
				    case FileType.File:
					    deleteQuery = @"CREATE TEMPORARY TABLE temp_file_ids AS
SELECT file.id
FROM wiser_itemfile file
JOIN wiser_item `directory` ON `directory`.id = file.item_id
JOIN wiser_itemdetail directory_full_path ON directory_full_path.item_id = `directory`.id AND directory_full_path.`key` = 'full_path'
JOIN wiser_itemdetail directory_context ON directory_context.item_id = `directory`.id AND directory_context.`key` = 'context'
WHERE
    file.file_name = ?name AND
    directory_full_path.`value` = ?path AND
    directory_context.`value` = ?context;
DELETE FROM wiser_itemfile
WHERE id IN (SELECT id FROM temp_file_ids);
DROP TEMPORARY TABLE temp_file_ids;";
					    break;
				    case FileType.Folder:
					    deleteQuery = @"CREATE TEMPORARY TABLE temp_ids AS
SELECT `directory`.id
FROM wiser_item `directory`
JOIN wiser_itemdetail directory_path ON directory_path.item_id = `directory`.id AND directory_path.`key` = 'path'
JOIN wiser_itemdetail directory_context ON directory_context.item_id = `directory`.id AND directory_context.`key` = 'context'
WHERE
    `directory`.entity_type = 'ImageDirectory' AND
    (`directory`.title = ?name OR directory_path.`value` LIKE CONCAT(?path, '%')) AND
    directory_context.`value` = ?context;
DELETE FROM wiser_item WHERE id IN (SELECT id FROM temp_ids);
DROP TEMPORARY TABLE temp_ids;";
					    break;
			    }
		    
			    databaseConnection.ClearParameters();
			    databaseConnection.AddParameter("name", model.Name);
			    databaseConnection.AddParameter("path", model.Path);
			    databaseConnection.AddParameter("context", identifier);
		    
			    deleteTasks.Add(databaseConnection.ExecuteAsync(deleteQuery));
		    }
		    catch (GclQueryException)
		    {
			    failedDeletions++;
			    throw;
		    }
	    }
	    
	    await Task.WhenAll(deleteTasks);
	    
	    return models.Length - failedDeletions;
    }

    public async Task<string> UploadImageAsync(IFormFile image, string path, string identifier)
    {
	    string fileQuery = @"
SET @ordering = (
SELECT COUNT(*) + 1
FROM wiser_itemfile
WHERE property_name = 'file'
);
SET @directoryId = (
SELECT `directory`.id
FROM wiser_item `directory`
JOIN wiser_itemdetail directory_full_path ON directory_full_path.item_id = `directory`.id AND directory_full_path.`key` = 'full_path'
JOIN wiser_itemdetail directory_context ON directory_context.item_id = `directory`.id AND directory_context.`key` = 'context'
WHERE `directory`.entity_type = 'ImageDirectory' AND directory_full_path.`value` = ?path AND directory_context.`value` = ?identifier
);
SET @directoryId = IFNULL(@directoryId, (
	SELECT `directory`.id
	FROM wiser_item `directory`
	JOIN wiser_itemdetail directory_full_path ON directory_full_path.item_id = `directory`.id AND directory_full_path.`key` = 'full_path'
	JOIN wiser_itemdetail directory_context ON directory_context.item_id = `directory`.id AND directory_context.`key` = 'context'
	WHERE `directory`.entity_type = 'ImageDirectory' AND directory_full_path.`value` = '/' AND directory_context.`value` = ?identifier
));
INSERT INTO wiser_itemfile (item_id, content_type, content, file_name, extension, property_name, ordering)
VALUES(@directoryId, ?contentType, ?content, ?fileName, ?extension, 'file', @ordering);
SELECT item_id AS `item_id`, ordering AS `ordering` FROM wiser_itemfile WHERE id = LAST_INSERT_ID();";

	    byte[] fileContent = new byte[0];
	    using (MemoryStream memoryStream = new MemoryStream())
	    {
		    await using (Stream fileStream = image.OpenReadStream())
		    {
			    await fileStream.CopyToAsync(memoryStream);
			    fileContent = memoryStream.ToArray();
		    }
	    }
	    
	    databaseConnection.ClearParameters();
	    databaseConnection.AddParameter("path", path);
	    databaseConnection.AddParameter("identifier", identifier);
	    databaseConnection.AddParameter("contentType", image.ContentType);
	    databaseConnection.AddParameter("content", fileContent);
	    databaseConnection.AddParameter("fileName", image.FileName);
	    databaseConnection.AddParameter("extension", Path.GetExtension(image.FileName));

	    DbDataReader itemIdReader = await databaseConnection.GetReaderAsync(fileQuery);

	    ulong itemId = 0;
	    int ordering = 0;
	    if (await itemIdReader.ReadAsync())
	    {
		    itemId = (ulong)itemIdReader.GetInt64(itemIdReader.GetOrdinal("item_id"));
		    ordering = itemIdReader.GetInt32(itemIdReader.GetOrdinal("ordering"));
	    }
	    await itemIdReader.CloseAsync();
	    
	    return $"/api/v3/items/{itemId}/files/file/{image.FileName}?ordering={ordering}";
    }

    public async Task<PreMadeTopolTemplatesResult> GetTemplatesAsync(string queryId, string countQueryId, int currentPage, string search, string sortBy, string sortByDirection, ClaimsIdentity identity)
    {
	    await databaseConnection.EnsureOpenConnectionForReadingAsync();
	    int unencryptedQueryId = await wiserTenantsService.DecryptValue<int>(queryId, identity);
	    int unencryptedCountQueryId = await wiserTenantsService.DecryptValue<int>(countQueryId, identity);
	    
	    const int itemsPerPage = 25;
	    int itemsOffset = itemsPerPage * (currentPage - 1);

	    Dictionary<string, object> replacementData = new Dictionary<string, object>
	    {
		    { "items_per_page", itemsPerPage.ToString() },
		    { "page", currentPage.ToString() },
		    { "offset", itemsOffset },
		    { "search", search },
		    { "sort_by", sortBy },
		    { "sort_by_direction", sortByDirection }
	    };

	    PreMadeTopolTemplate[] templates = await BuildTemplatesBasedFromQuery(unencryptedQueryId, identity, replacementData);
	    
	    string templatesCountQueryQuery = $"SELECT query FROM {WiserTableNames.WiserQuery} WHERE id = ?queryId";
	    databaseConnection.ClearParameters();
	    databaseConnection.AddParameter("queryId", unencryptedCountQueryId);
	    DataTable templatesCountDataTable = await databaseConnection.GetAsync(templatesCountQueryQuery);
	    
	    string templatesCountQuery = templatesCountDataTable.Rows[0].Field<string>("query");
	    templatesCountQuery = apiReplacementsService.DoIdentityReplacements(templatesCountQuery, identity, true);
	    templatesCountQuery = stringReplacementsService.DoReplacements(templatesCountQuery, replacementData, forQuery: true);
	    templatesCountQuery = stringReplacementsService.EvaluateTemplate(templatesCountQuery);

	    DbDataReader templatesCountReader = await databaseConnection.GetReaderAsync(templatesCountQuery);
	    int templatesCount = await templatesCountReader.ReadAsync() ? templatesCountReader.GetInt32(0) : 0;
	    await templatesCountReader.CloseAsync();
	    
	    int totalRecords = templatesCount;
	    bool hasNextPage = totalRecords > currentPage* itemsPerPage;
	    int? nextPage = hasNextPage ? currentPage + 1 : null;
	    int? previousPage = currentPage > 1 ? currentPage - 1 : null;
	    int lastPage = (int) Math.Ceiling((double) totalRecords / itemsPerPage);

	    return new PreMadeTopolTemplatesResult
	    {
		    Templates = templates,
		    TotalRecords = totalRecords,
		    CurrentPage = currentPage,
		    PerPage = itemsPerPage,
		    NextPage = nextPage,
		    PreviousPage = previousPage,
		    LastPage = lastPage
	    };
    }

    public async Task<PreMadeTopolTemplate> GetTemplateAsync(ulong id, ClaimsIdentity identity)
    {
	    return null;
    }

    public async Task<TopolCategory[]> GetTemplateCategoriesAsync()
    {
	    return new TopolCategory[]
	    {
		    new TopolCategory
		    {
			    Id = 1,
			    Name = "Coder",
			    Value = "coder"
		    },
		    new TopolCategory
		    {
			    Id = 2,
			    Name = "Topol",
			    Value = "topol"
		    }
	    };
    }

    public async Task<TopolKeyword[]> GetTemplateKeywordsAsync() => new TopolKeyword[0];

    public async Task SendTestMailAsync(string email, string html)
    {
	    string subject = "Coder - Test mail";
	    await communicationsService.SendEmailAsync(email, subject, html);
    }
    
    /// <summary>
    /// Runs the query and builds <see cref="PreMadeTopolTemplate"/> instances based on the results.
    /// </summary>
    /// <param name="queryId">The unencrypted query ID to run for the data to base the templates off of.</param>
    /// <param name="identity">The identity of the current user of this request for identity-based replacements on the query.</param>
    /// <param name="replacementData">A data map of replacements to apply in the query that is ran.</param>
    /// <returns>A collection of <see cref="PreMadeTopolTemplate"/> instances built based on the provided data from the query.</returns>
    private async Task<PreMadeTopolTemplate[]> BuildTemplatesBasedFromQuery(int queryId, ClaimsIdentity identity, Dictionary<string, object> replacementData)
    {
	    List<PreMadeTopolTemplate> templates = new List<PreMadeTopolTemplate>();
	    
	    string templatesQueryQuery = $"SELECT query FROM {WiserTableNames.WiserQuery} WHERE id = ?queryId";
	    databaseConnection.ClearParameters();
	    databaseConnection.AddParameter("queryId", queryId);
	    DataTable dataTable = await databaseConnection.GetAsync(templatesQueryQuery);
	    
	    string templatesQuery = dataTable.Rows[0].Field<string>("query");
	    templatesQuery = apiReplacementsService.DoIdentityReplacements(templatesQuery, identity, true);
	    templatesQuery = stringReplacementsService.DoReplacements(templatesQuery, replacementData, forQuery: true);
	    templatesQuery = stringReplacementsService.EvaluateTemplate(templatesQuery);

	    DbDataReader templatesReader = await databaseConnection.GetReaderAsync(templatesQuery);
	    while (await templatesReader.ReadAsync())
	    {
		    ulong id = (ulong) templatesReader.GetInt64(templatesReader.GetOrdinal("id"));
		    string name = templatesReader.GetString(templatesReader.GetOrdinal("name"));
		    string html = templatesReader.GetString(templatesReader.GetOrdinal("html"));
		    string json = templatesReader.GetString(templatesReader.GetOrdinal("json"));
		    string description = templatesReader.HasColumn("description")
			    ? templatesReader.GetString(templatesReader.GetOrdinal("description"))
			    : "Een Coder template.";
		    DateTime createdAt = templatesReader.GetDateTime(templatesReader.GetOrdinal("created_at"));
		    DateTime updatedAt = templatesReader.HasColumn("updated_at")
			    ? templatesReader.GetDateTime(templatesReader.GetOrdinal("updated_at"))
			    : createdAt;
		    string image = templatesReader.HasColumn("image")
			    ? templatesReader.GetString(templatesReader.GetOrdinal("image"))
			    : null;

		    PreMadeTopolTemplate template = new PreMadeTopolTemplate
		    {
			    Id = id,
			    Name = name,
			    Type = TemplateType.Free,
			    Html = html,
			    Json = json,
			    CategoryId = 1,
			    Description = description,
			    Visible = true,
			    CreatedAt = createdAt,
			    UpdatedAt = updatedAt,
			    ImagePath = image,
			    ImageThumbPath = image,
			    ImgThumbUrl = image,
			    Category = null,
			    Keywords = new string[0]
		    };
		    
		    templates.Add(template);
	    }

	    await templatesReader.CloseAsync();

	    return templates.ToArray();
    }
}