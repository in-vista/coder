﻿using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using Api.Core.Helpers;
using Api.Core.Interfaces;
using Api.Core.Models;
using Api.Core.Services;
using Api.Modules.Branches.Interfaces;
using Api.Modules.EntityProperties.Enums;
using Api.Modules.EntityProperties.Interfaces;
using Api.Modules.EntityTypes.Models;
using Api.Modules.Files.Interfaces;
using Api.Modules.Google.Interfaces;
using Api.Modules.Items.Interfaces;
using Api.Modules.Items.Models;
using Api.Modules.Templates.Interfaces;
using Api.Modules.Tenants.Interfaces;
using CM.Text.BusinessMessaging.Model;
using GeeksCoreLibrary.Core.DependencyInjection.Interfaces;
using GeeksCoreLibrary.Core.Enums;
using GeeksCoreLibrary.Core.Exceptions;
using GeeksCoreLibrary.Core.Extensions;
using GeeksCoreLibrary.Core.Helpers;
using GeeksCoreLibrary.Core.Interfaces;
using GeeksCoreLibrary.Core.Models;
using GeeksCoreLibrary.Modules.Databases.Interfaces;
using GeeksCoreLibrary.Modules.GclReplacements.Interfaces;
using GeeksCoreLibrary.Modules.Languages.Interfaces;
using GeeksCoreLibrary.Modules.Objects.Interfaces;
using Google.Cloud.Translation.V2;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MySqlConnector;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using GclCoreConstants = GeeksCoreLibrary.Core.Models.Constants;

namespace Api.Modules.Items.Services
{
    /// <summary>
    /// A service for working with Wiser items for the new Wiser data structure that was introduced in early 2019.
    /// </summary>
    public class ItemsService : IItemsService, IScopedService
    {
        private readonly ITemplatesService templatesService;
        private readonly IWiserTenantsService wiserTenantsService;
        private readonly IDatabaseConnection clientDatabaseConnection;
        private readonly IHttpContextAccessor httpContextAccessor;
        private readonly IWiserItemsService wiserItemsService;
        private readonly IJsonService jsonService;
        private readonly ILogger<ItemsService> logger;
        private readonly IStringReplacementsService stringReplacementsService;
        private readonly IApiReplacementsService apiReplacementsService;
        private readonly IFilesService filesService;
        private readonly IDatabaseHelpersService databaseHelpersService;
        private readonly ILanguagesService languagesService;
        private readonly IEntityPropertiesService entityPropertiesService;
        private readonly IGoogleTranslateService googleTranslateService;
        private readonly IObjectsService objectsService;
        private readonly IServiceProvider serviceProvider;
        private readonly IBranchesService branchesService;

        /// <summary>
        /// Creates a new instance of <see cref="ItemsService"/>.
        /// </summary>
        public ItemsService(ITemplatesService templatesService,
                            IWiserTenantsService wiserTenantsService,
                            IDatabaseConnection clientDatabaseConnection,
                            IHttpContextAccessor httpContextAccessor,
                            IWiserItemsService wiserItemsService,
                            IJsonService jsonService,
                            ILogger<ItemsService> logger,
                            IStringReplacementsService stringReplacementsService,
                            IApiReplacementsService apiReplacementsService,
                            IFilesService filesService,
                            IDatabaseHelpersService databaseHelpersService,
                            ILanguagesService languagesService,
                            IEntityPropertiesService entityPropertiesService,
                            IGoogleTranslateService googleTranslateService,
                            IObjectsService objectsService,
                            IServiceProvider serviceProvider,
                            IBranchesService branchesService)
        {
            this.templatesService = templatesService;
            this.wiserTenantsService = wiserTenantsService;
            this.clientDatabaseConnection = clientDatabaseConnection;
            this.httpContextAccessor = httpContextAccessor;
            this.wiserItemsService = wiserItemsService;
            this.jsonService = jsonService;
            this.logger = logger;
            this.stringReplacementsService = stringReplacementsService;
            this.apiReplacementsService = apiReplacementsService;
            this.filesService = filesService;
            this.databaseHelpersService = databaseHelpersService;
            this.languagesService = languagesService;
            this.entityPropertiesService = entityPropertiesService;
            this.googleTranslateService = googleTranslateService;
            this.objectsService = objectsService;
            this.serviceProvider = serviceProvider;
            this.branchesService = branchesService;
        }

        /// <inheritdoc />
        public async Task<ServiceResult<PagedResults<FlatItemModel>>> GetItemsAsync(ClaimsIdentity identity, GetItemsInputModel input)
        {
            input ??= new GetItemsInputModel();

            input.PageSize = input.PageSize switch
            {
                > 500 => 500,
                <= 0 => 100,
                _ => input.PageSize
            };

            var userId = IdentityHelpers.GetWiserUserId(identity);

            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            clientDatabaseConnection.ClearParameters();
            clientDatabaseConnection.AddParameter("userId", userId);

            var whereClause = new List<string>();
            var extraJoins = new StringBuilder();
            if (!String.IsNullOrWhiteSpace(input.Title))
            {
                whereClause.Add("item.title = ?title");
                clientDatabaseConnection.AddParameter("title", input.Title);
            }

            if (input.Details != null && input.Details.Any())
            {
                for (var index = 0; index < input.Details.Count; index++)
                {
                    var detail = input.Details[index];
                    if (String.IsNullOrWhiteSpace(detail?.Key))
                        continue;
                    
                    clientDatabaseConnection.AddParameter($"key{index}", detail.Key);
                    extraJoins.Append($"JOIN {WiserTableNames.WiserItemDetail} AS d{index} ON d{index}.item_id = item.id AND d{index}.`key` = ?key{index}");
                    if (!String.IsNullOrWhiteSpace(detail.LanguageCode))
                    {
                        clientDatabaseConnection.AddParameter($"languageCode{index}", detail.LanguageCode);
                        extraJoins.Append($" AND d{index}.language_code = ?languageCode{index}");
                    }
                    if (!String.IsNullOrWhiteSpace(detail.Value))
                    {
                        clientDatabaseConnection.AddParameter($"value{index}", detail.Value);
                        extraJoins.Append($" AND (d{index}.value = ?value{index} OR d{index}.long_value = ?value{index})");
                    }
                    if (!String.IsNullOrWhiteSpace(detail.GroupName))
                    {
                        clientDatabaseConnection.AddParameter($"groupName{index}", detail.GroupName);
                        extraJoins.Append($" AND d{index}.groupName = ?groupName{index}");
                    }

                    extraJoins.AppendLine();
                }
            }

            var pagedResult = new PagedResults<FlatItemModel>();

            var countQuery = $@"SELECT COUNT(*) AS totalResults
                                FROM {WiserTableNames.WiserItem} AS item

                                {extraJoins}

                                # Check permissions. Default permissions are everything enabled, so if the user has no role or the role has no permissions on this item, they are allowed everything.
	                            LEFT JOIN {WiserTableNames.WiserUserRoles} user_role ON user_role.user_id = ?userId
	                            LEFT JOIN {WiserTableNames.WiserPermission} permission_item ON permission_item.role_id = user_role.role_id AND permission_item.item_id = item.id
                                LEFT JOIN {WiserTableNames.WiserPermission} permission_module ON permission_module.role_id = user_role.role_id AND permission_module.module_id = item.moduleid

                                WHERE item.published_environment >= 1
                                AND (
                                    (permission_item.permissions & 1) > 0
                                    OR (permission_item.permissions IS NULL AND (permission_module.permissions & 1) > 0)
                                    OR (permission_item.permissions IS NULL AND permission_module.permissions IS NULL)
                                )

                                {(!whereClause.Any() ? "" : $"AND {String.Join(" AND ", whereClause)}")}";

            var dataTable = await clientDatabaseConnection.GetAsync(countQuery);
            pagedResult.TotalNumberOfPages = Convert.ToInt32(Math.Ceiling((decimal)pagedResult.TotalNumberOfRecords / input.PageSize));
            pagedResult.PageNumber = input.Page;
            pagedResult.PageSize = input.PageSize;
            
            // Build the next and previous page URLs.
            var uriBuilder = HttpContextHelpers.GetOriginalRequestUriBuilder(httpContextAccessor.HttpContext);
            var queryBuilder = HttpUtility.ParseQueryString(uriBuilder.Query);
            if (pagedResult.TotalNumberOfPages > input.Page)
            {
                queryBuilder["page"] = (input.Page + 1).ToString();
                uriBuilder.Query = queryBuilder.ToString() ?? String.Empty;
                pagedResult.NextPageUrl = uriBuilder.Uri.ToString();
            }
            if (input.Page > 1)
            {
                queryBuilder["page"] = (input.Page - 1).ToString();
                uriBuilder.Query = queryBuilder.ToString() ?? String.Empty;
                pagedResult.PreviousPageUrl = uriBuilder.Uri.ToString();
            }

            var query = $@"
                SELECT
                    x.*,
                    0 AS readonly,
                    CAST(JSON_ARRAYAGG(JSON_OBJECT(
                        'id', IFNULL(field.id, 0),
                        'languageCode', IFNULL(field.language_code, property.language_code),
                        'groupName', IFNULL(field.groupname, property.group_name),
                        'key', COALESCE(field.`key`, property.property_name, property.display_name),
                        'value', CONCAT_WS('', field.value, field.long_value),
                        'displayName', IFNULL(property.display_name, '')
                    )) AS CHAR) AS fields
                FROM (
                    SELECT
                        item.id,
                        item.unique_uuid,
                        item.entity_type,
                        item.moduleid,
                        item.published_environment,
                        item.title,
                        item.added_on,
                        item.added_by,
                        item.changed_on,
                        item.changed_by
                    FROM {WiserTableNames.WiserItem} AS item

                    {extraJoins}

                    # Check permissions. Default permissions are everything enabled, so if the user has no role or the role has no permissions on this item, they are allowed everything.
	                LEFT JOIN {WiserTableNames.WiserUserRoles} user_role ON user_role.user_id = ?userId
	                LEFT JOIN {WiserTableNames.WiserPermission} permission_item ON permission_item.role_id = user_role.role_id AND permission_item.item_id = item.id
                    LEFT JOIN {WiserTableNames.WiserPermission} permission_module ON permission_module.role_id = user_role.role_id AND permission_module.module_id = item.moduleid

                    WHERE item.published_environment >= 1
                    AND (
                        (permission_item.permissions & 1) > 0
                        OR (permission_item.permissions IS NULL AND (permission_module.permissions & 1) > 0)
                        OR (permission_item.permissions IS NULL AND permission_module.permissions IS NULL)
                    )

                    {(!whereClause.Any() ? "" : $"AND {String.Join(" AND ", whereClause)}")}

                    GROUP BY item.id
					ORDER BY IFNULL(item.changed_on, item.added_on) DESC
                    LIMIT {(input.Page - 1) * input.PageSize}, {input.PageSize}
                ) AS x
                LEFT JOIN {WiserTableNames.WiserEntityProperty} AS property ON property.entity_name = x.entity_type AND property.inputtype NOT IN ('file-upload', 'querybuilder', 'grid', 'button', 'image-upload', 'sub-entities-grid', 'item-linker', 'linked-item', 'action-button', 'data-selector', 'chart', 'scheduler', 'timeline', 'empty', 'qr')
                LEFT JOIN {WiserTableNames.WiserItemDetail} AS field ON field.item_id = x.id AND field.`key` = IFNULL(property.property_name, property.display_name) AND field.language_code = property.language_code
                GROUP BY x.id
				ORDER BY IFNULL(x.changed_on, x.added_on) DESC
            ";
            dataTable = await clientDatabaseConnection.GetAsync(query);

            if (dataTable.Rows.Count == 0)
            {
                return new ServiceResult<PagedResults<FlatItemModel>>(pagedResult);
            }

            var items = new List<FlatItemModel>();
            foreach (DataRow dataRow in dataTable.Rows)
            {
                var item = new FlatItemModel
                {
                    Id = dataRow.Field<ulong>("id"),
                    AddedBy = dataRow.Field<string>("added_by"),
                    AddedOn = dataRow.Field<DateTime>("added_on"),
                    ChangedBy = dataRow.Field<string>("changed_by"),
                    EntityType = dataRow.Field<string>("entity_type"),
                    ModuleId = dataRow.Field<int>("moduleid"),
                    PublishedEnvironment = (Environments)dataRow.Field<int>("published_environment"),
                    Title = dataRow.Field<string>("title"),
                    UniqueUuid = dataRow.Field<string>("unique_uuid")
                };

                if (!dataRow.IsNull("changed_on"))
                {
                    item.ChangedOn = dataRow.Field<DateTime>("changed_on");
                }

                var fieldsJson = dataRow.Field<string>("fields");
                var fields = String.IsNullOrWhiteSpace(fieldsJson) ? new List<DisplayItemDetailModel>() : JsonConvert.DeserializeObject<List<DisplayItemDetailModel>>(fieldsJson);
                foreach (var field in fields)
                {
                    if (String.IsNullOrWhiteSpace(field.Key))
                    {
                        continue;
                    }
                
                    var name = field.DisplayName;
                    if (String.IsNullOrWhiteSpace(name) || !input.UseFriendlyPropertyNames)
                    {
                        name = field.Key;
                    }

                    if (!String.IsNullOrWhiteSpace(field.LanguageCode))
                    {
                        name += $" ({field.LanguageCode})";
                    }

                    item.Fields.Add(name, field.Value);
                }

                items.Add(item);
            }

            pagedResult.Results = items;

            return new ServiceResult<PagedResults<FlatItemModel>>(pagedResult);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<WiserItemDuplicationResultModel>> DuplicateItemAsync(string encryptedId, string encryptedParentId, ClaimsIdentity identity, string entityType = null, string parentEntityType = null)
        {
            if (String.IsNullOrWhiteSpace(encryptedId))
            {
                throw new ArgumentNullException(nameof(encryptedId));
            }
            if (String.IsNullOrWhiteSpace(encryptedParentId))
            {
                throw new ArgumentNullException(nameof(encryptedParentId));
            }

            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var itemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);
            var parentId = await wiserTenantsService.DecryptValue<ulong>(encryptedParentId, identity);
            var username = IdentityHelpers.GetUserName(identity, true);
            var tenant = await wiserTenantsService.GetSingleAsync(identity);
            var encryptionKey = tenant.ModelObject.EncryptionKey;

            WiserItemDuplicationResultModel result;
            try
            {
                result = await wiserItemsService.DuplicateItemAsync(itemId, parentId, username, encryptionKey, IdentityHelpers.GetWiserUserId(identity), entityType, parentEntityType);
            }
            catch (InvalidAccessPermissionsException exception)
            {
                return new ServiceResult<WiserItemDuplicationResultModel>
                {
                    ErrorMessage = exception.Message,
                    StatusCode = HttpStatusCode.Forbidden
                };
            }

            return new ServiceResult<WiserItemDuplicationResultModel>(result);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<WiserItemModel>> CopyToEnvironmentAsync(string encryptedId, Environments newEnvironments, ClaimsIdentity identity)
        {
            if (String.IsNullOrWhiteSpace(encryptedId))
            {
                throw new ArgumentNullException(nameof(encryptedId));
            }

            try
            {
                await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
                await clientDatabaseConnection.BeginTransactionAsync();

                var originalItemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);
                var item = await wiserItemsService.GetItemDetailsAsync(originalItemId);

                if (item == null || item.Id == 0)
                {
                    return new ServiceResult<WiserItemModel>
                    {
                        StatusCode = HttpStatusCode.NotFound
                    };
                }

                var userId = IdentityHelpers.GetWiserUserId(identity);
                var (success, _, _) = await wiserItemsService.CheckIfEntityActionIsPossibleAsync(item.Id, EntityActions.Update, userId, onlyCheckAccessRights: true, entityType: item.EntityType);
                if (!success)
                {
                    return new ServiceResult<WiserItemModel>
                    {
                        StatusCode = HttpStatusCode.Forbidden
                    };
                }

                clientDatabaseConnection.AddParameter("entityType", item.EntityType);
                var dataTable = await clientDatabaseConnection.GetAsync($"SELECT enable_multiple_environments FROM {WiserTableNames.WiserEntity} WHERE name = ?entityType");
                if (dataTable.Rows.Count == 0 || !Convert.ToBoolean(dataTable.Rows[0]["enable_multiple_environments"]))
                {
                    return new ServiceResult<WiserItemModel>
                    {
                        StatusCode = HttpStatusCode.BadRequest,
                        ErrorMessage = $"Multiple environments functionality is disabled for entity type '{item.EntityType}'."
                    };
                }

                var tablePrefix = await wiserItemsService.GetTablePrefixForEntityAsync(item.EntityType);
                var username = IdentityHelpers.GetUserName(identity, true);
                var tenant = await wiserTenantsService.GetSingleAsync(identity);
                var encryptionKey = tenant.ModelObject.EncryptionKey;
                var allLinkSettings = await wiserItemsService.GetAllLinkTypeSettingsAsync();

                var query = $@"SELECT other.id, current.original_item_id, other.published_environment
                            FROM {tablePrefix}{WiserTableNames.WiserItem} AS current
                            LEFT JOIN {tablePrefix}{WiserTableNames.WiserItem} AS other ON other.original_item_id = current.original_item_id
                            WHERE current.id = ?id";

                clientDatabaseConnection.ClearParameters();
                clientDatabaseConnection.AddParameter("id", originalItemId);
                dataTable = await clientDatabaseConnection.GetAsync(query);

                if (dataTable.Rows.Count == 0)
                {
                    return new ServiceResult<WiserItemModel>
                    {
                        StatusCode = HttpStatusCode.NotFound
                    };
                }

                var mainItemId = dataTable.Rows[0].Field<ulong>("original_item_id");
                var copyToDevelopment = (newEnvironments & Environments.Development) == Environments.Development;
                var copyToTest = (newEnvironments & Environments.Test) == Environments.Test;
                var copyToAcceptance = (newEnvironments & Environments.Acceptance) == Environments.Acceptance;
                var copyToLive = (newEnvironments & Environments.Live) == Environments.Live;
                var createNewItem = true;

                foreach (DataRow dataRow in dataTable.Rows)
                {
                    var otherItemId = dataRow.Field<ulong>("id");
                    var environments = (Environments)dataRow.Field<int>("published_environment");

                    // If there already is an item with the exact same environments, we can just overwrite that one.
                    if (environments == newEnvironments)
                    {
                        // Item if the item that we're copying to different environments.
                        // So we want to take this item and change the ID to that of the item with the correct environment, so that we will overwrite it.
                        item.Id = otherItemId;
                        item.OriginalItemId = mainItemId;
                        item.PublishedEnvironment = newEnvironments;
                        item.Details.ForEach(d => d.Changed = true);
                        await wiserItemsService.UpdateAsync(otherItemId, item, userId, username, encryptionKey);
                        createNewItem = false;
                        break;
                    }

                    var isForDevelopment = (environments & Environments.Development) == Environments.Development;
                    var isForTest = (environments & Environments.Test) == Environments.Test;
                    var isForAcceptance = (environments & Environments.Acceptance) == Environments.Acceptance;
                    var isForLive = (environments & Environments.Live) == Environments.Live;
                    var changed = false;

                    // See if we need to unset bits in the environment.
                    if (copyToDevelopment && isForDevelopment)
                    {
                        environments &= ~Environments.Development;
                        changed = true;
                    }
                    if (copyToTest && isForTest)
                    {
                        environments &= ~Environments.Test;
                        changed = true;
                    }
                    if (copyToAcceptance && isForAcceptance)
                    {
                        environments &= ~Environments.Acceptance;
                        changed = true;
                    }
                    if (copyToLive && isForLive)
                    {
                        environments &= ~Environments.Live;
                        changed = true;
                    }

                    if (!changed)
                    {
                        continue;
                    }

                    // Save the item if we unset one or more bits for environment.
                    var otherItem = await wiserItemsService.GetItemDetailsAsync(otherItemId, entityType: item.EntityType);
                    otherItem.PublishedEnvironment = environments;
                    otherItem.OriginalItemId = mainItemId;
                    await wiserItemsService.UpdateAsync(otherItemId, otherItem, userId, username, encryptionKey);
                }

                // Copy the item to a new item for the selected environments.
                if (createNewItem)
                {
                    item.Id = 0;
                    item.OriginalItemId = mainItemId;
                    item.PublishedEnvironment = newEnvironments;
                    item.Details.ForEach(d => d.Changed = true);
                    await wiserItemsService.SaveAsync(item, userId: userId, username: username, encryptionKey: encryptionKey);
                }

                var linksWithDedicatedTables = allLinkSettings.Where(l => String.Equals(l.SourceEntityType, item.EntityType, StringComparison.OrdinalIgnoreCase) || String.Equals(l.SourceEntityType, item.EntityType, StringComparison.OrdinalIgnoreCase)).ToList();

                // Copy links.
                var linksToKeep = new List<ulong>();
                if (!linksWithDedicatedTables.Any())
                {
                    query = $@"SELECT
    link.id,
    link.type,
    link.destination_item_id,
    link.item_id
FROM {WiserTableNames.WiserItemLink} AS link
JOIN {tablePrefix}{WiserTableNames.WiserItem} AS item1 ON item1.id = link.item_id
JOIN {tablePrefix}{WiserTableNames.WiserItem} AS item2 ON item2.id = link.destination_item_id
WHERE link.item_id = ?id
OR link.destination_item_id = ?id";
                }
                else
                {
                    var linkQueryBuilder = new List<string>();
                    foreach (var linkSettings in linksWithDedicatedTables)
                    {
                        var linkTablePrefix = wiserItemsService.GetTablePrefixForLink(linkSettings);
                        linkQueryBuilder.Add($@"SELECT
    link.id,
    link.type,
    link.destination_item_id,
    link.item_id
FROM {linkTablePrefix}{WiserTableNames.WiserItemLink} AS link
JOIN {tablePrefix}{WiserTableNames.WiserItem} AS item1 ON item1.id = link.item_id
JOIN {tablePrefix}{WiserTableNames.WiserItem} AS item2 ON item2.id = link.destination_item_id
WHERE link.item_id = ?id
OR link.destination_item_id = ?id");
                    }

                    query = String.Join(" UNION ALL ", linkQueryBuilder);
                }

                clientDatabaseConnection.ClearParameters();
                clientDatabaseConnection.AddParameter("id", originalItemId);
                dataTable = await clientDatabaseConnection.GetAsync(query);
                if (dataTable.Rows.Count > 0)
                {
                    foreach (DataRow dataRow in dataTable.Rows)
                    {
                        clientDatabaseConnection.ClearParameters();
                        var previousLinkId = Convert.ToUInt64(dataRow["id"]);
                        var type = Convert.ToInt32(dataRow["type"]);

                        // If the destination item ID of this link is the original item, change that to the new item and add that as a new link.
                        var destinationItemId = Convert.ToUInt64(dataRow["destination_item_id"]);
                        if (destinationItemId == originalItemId)
                        {
                            destinationItemId = item.Id;
                        }

                        // If the source item ID of this link is the original item, change that to the new item and add that as a new link.
                        var linkedItemId = Convert.ToUInt64(dataRow["item_id"]);
                        if (linkedItemId == originalItemId)
                        {
                            linkedItemId = item.Id;
                        }

                        // Add the new link.
                        var newLinkId = await wiserItemsService.AddItemLinkAsync(linkedItemId, destinationItemId, type, userId: userId, username: username);
                        linksToKeep.Add(newLinkId);
                        var linkTablePrefix = await wiserItemsService.GetTablePrefixForLinkAsync(type);

                        // Add the link details.
                        clientDatabaseConnection.AddParameter("previousLinkId", previousLinkId);
                        clientDatabaseConnection.AddParameter("newLinkId", newLinkId);
                        clientDatabaseConnection.AddParameter("username", username);
                        clientDatabaseConnection.AddParameter("userId", userId);
                        clientDatabaseConnection.AddParameter("saveHistoryJcl", true); // This is used in triggers.
                        await clientDatabaseConnection.ExecuteAsync($@"SET @_username = ?username;
                                                                    SET @_userId = ?userId;
                                                                    SET @saveHistory = ?saveHistoryJcl;
                                                                    INSERT INTO {linkTablePrefix}{WiserTableNames.WiserItemLinkDetail} (language_code, itemlink_id, groupname, `key`, value, long_value)
                                                                    SELECT language_code, ?newLinkId, groupname, `key`, value, long_value
                                                                    FROM {linkTablePrefix}{WiserTableNames.WiserItemLinkDetail}
                                                                    WHERE itemlink_id = ?previousLinkId
                                                                    ON DUPLICATE KEY UPDATE value = VALUES(value), long_value = VALUES(long_value), groupname = VALUES(groupname)");
                    }
                }

                // Delete links that have been removed.
                if (!createNewItem)
                {
                    var wherePart = !linksToKeep.Any() ? "" : $" AND link.id NOT IN ({String.Join(",", linksToKeep)})";
                    clientDatabaseConnection.ClearParameters();
                    clientDatabaseConnection.AddParameter("id", item.Id);

                    if (!linksWithDedicatedTables.Any())
                    {
                        query = $@"DELETE FROM {WiserTableNames.WiserItemLink} AS link WHERE (link.item_id = ?id OR link.destination_item_id = ?id) {wherePart};";
                    }
                    else
                    {
                        foreach (var linkSettings in linksWithDedicatedTables)
                        {
                            var linkTablePrefix = wiserItemsService.GetTablePrefixForLink(linkSettings);
                            query += $@"
DELETE FROM {linkTablePrefix}{WiserTableNames.WiserItemLink} AS link WHERE (link.item_id = ?id OR link.destination_item_id = ?id) {wherePart};";
                        }
                    }

                    await clientDatabaseConnection.ExecuteAsync(query);
                }

                await clientDatabaseConnection.CommitTransactionAsync();
                return new ServiceResult<WiserItemModel>(item);
            }
            catch (InvalidAccessPermissionsException exception)
            {
                await clientDatabaseConnection.RollbackTransactionAsync(false);
                return new ServiceResult<WiserItemModel>
                {
                    ErrorMessage = exception.Message,
                    StatusCode = HttpStatusCode.Forbidden
                };
            }
            catch
            {
                await clientDatabaseConnection.RollbackTransactionAsync(false);
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<ServiceResult<bool>> ChangeEnvironmentAsync(string encryptedId, string entityType, Environments newEnvironments, ClaimsIdentity identity)
        {
            if (String.IsNullOrWhiteSpace(encryptedId))
            {
                throw new ArgumentNullException(nameof(encryptedId));
            }

            try
            {
                await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();

                var originalItemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);
                var userId = IdentityHelpers.GetWiserUserId(identity);
                var username = IdentityHelpers.GetUserName(identity, true);
                var item = await wiserItemsService.GetItemDetailsAsync(originalItemId, entityType: entityType, userId: userId);
                if (item == null || item.Id == 0)
                {
                    return new ServiceResult<bool>(false)
                    {
                        StatusCode = HttpStatusCode.NotFound
                    };
                }

                item.PublishedEnvironment = newEnvironments;
                await wiserItemsService.UpdateAsync(originalItemId, item, userId, username);
                return new ServiceResult<bool>(true)
                {
                    StatusCode = HttpStatusCode.NoContent
                };
            }
            catch (InvalidAccessPermissionsException exception)
            {
                return new ServiceResult<bool>(false)
                {
                    ErrorMessage = exception.Message,
                    StatusCode = HttpStatusCode.Forbidden
                };
            }
        }

        /// <inheritdoc />
        public async Task<ServiceResult<CreateItemResultModel>> CreateAsync(WiserItemModel item, ClaimsIdentity identity, string encryptedParentId = null, int linkType = 1, bool alsoCreateInMainBranch = false)
        {
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var tenant = await wiserTenantsService.GetSingleAsync(identity);
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var username = IdentityHelpers.GetUserName(identity, true);
            var encryptionKey = tenant.ModelObject.EncryptionKey;

            ulong parentId = 0;
            if (!String.IsNullOrWhiteSpace(encryptedParentId))
            {
                parentId = await wiserTenantsService.DecryptValue<ulong>(encryptedParentId, identity);
            }

            var result = new CreateItemResultModel();
            try
            {
                await clientDatabaseConnection.BeginTransactionAsync();
                WiserItemModel newItem = null;
                var createInBothDatabases = alsoCreateInMainBranch && !branchesService.IsMainBranch(tenant.ModelObject).ModelObject;

                // Create a new item in both the branch as the main database using the same ID.
                if (createInBothDatabases)
                {
                    using var scope = serviceProvider.CreateScope();
                    var mainDatabaseConnection = scope.ServiceProvider.GetRequiredService<IDatabaseConnection>();
                    var mainTenant = await wiserTenantsService.GetSingleAsync(tenant.ModelObject.TenantId, true);
                    var mainBranchConnectionString = wiserTenantsService.GenerateConnectionStringFromTenant(mainTenant.ModelObject);
                    await mainDatabaseConnection.ChangeConnectionStringsAsync(mainBranchConnectionString);
                    var wiserItemsServiceMainBranch = scope.ServiceProvider.GetRequiredService<IWiserItemsService>();
                    
                    // Check if parent ID is in the mappings. If true use ID for main database, if false throw exception.
                    var parentIdMainBranch = await branchesService.GetMappedIdAsync(parentId);

                    if (parentIdMainBranch == null)
                    {
                        return new ServiceResult<CreateItemResultModel>
                        {
                            ErrorMessage = $"Failed to create item in main branch. Parent item with ID {parentId} does not exist in main branch and can therefore not (safely) be mapped.",
                            StatusCode = HttpStatusCode.Forbidden
                        };
                    }

                    // Hide the item by default to prevent it from being used in production.
                    item.PublishedEnvironment = Environments.Hidden;
                    
                    var entityTypeSettings = await wiserItemsService.GetEntityTypeSettingsAsync(item.EntityType);
                    var tablePrefix = wiserItemsService.GetTablePrefixForEntity(entityTypeSettings);
                    
                    // Check which Wiser item link table needs to be locked.
                    clientDatabaseConnection.AddParameter("parentId", parentId);
                    var queryResult = await clientDatabaseConnection.GetAsync($@"SELECT entity_type FROM {tablePrefix}{WiserTableNames.WiserItem} WHERE id = ?parentId", true);
                    var destinationEntityType = "";
                    if (queryResult.Rows.Count > 0)
                    {
                        destinationEntityType = queryResult.Rows[0].Field<string>("entity_type");
                    }
                    var linkTypeSettings = await wiserItemsService.GetLinkTypeSettingsAsync(0, item.EntityType, destinationEntityType);
                    var linkTablePrefix = wiserItemsService.GetTablePrefixForLink(linkTypeSettings);

                    try
                    {
                        // Lock the tables in both databases to prevent a race condition when creating an item in both databases with the same ID.
                        await mainDatabaseConnection.ExecuteAsync($"LOCK TABLES {tablePrefix}{WiserTableNames.WiserItem} WRITE, {tablePrefix}{WiserTableNames.WiserItem} item READ, {WiserTableNames.WiserUserRoles} user_role READ, {WiserTableNames.WiserPermission} permission READ, {WiserTableNames.WiserEntity} entity READ, {WiserTableNames.WiserEntityProperty} property READ, {WiserTableNames.WiserLink} READ, {linkTablePrefix}{WiserTableNames.WiserItemLink} WRITE");
                        await clientDatabaseConnection.ExecuteAsync($"LOCK TABLES {tablePrefix}{WiserTableNames.WiserItem} WRITE, {tablePrefix}{WiserTableNames.WiserItem} item READ, {WiserTableNames.WiserUserRoles} user_role READ, {WiserTableNames.WiserPermission} permission READ, {WiserTableNames.WiserEntity} entity READ, {WiserTableNames.WiserEntityProperty} property READ, {WiserTableNames.WiserLink} READ, {linkTablePrefix}{WiserTableNames.WiserItemLink} WRITE");
                        item.Id = await branchesService.GenerateNewIdAsync($"{tablePrefix}{WiserTableNames.WiserItem}", mainDatabaseConnection, clientDatabaseConnection);

                        await wiserItemsServiceMainBranch.CreateAsync(item, parentId, userId: userId, username: username, encryptionKey: encryptionKey, createNewTransaction: false, linkTypeNumber: linkType);
                        newItem = await wiserItemsService.CreateAsync(item, parentId, userId: userId, username: username, encryptionKey: encryptionKey, createNewTransaction: false, linkTypeNumber: linkType, saveHistory: false);
                    }
                    finally
                    {
                        await mainDatabaseConnection.ExecuteAsync("UNLOCK TABLES");
                        await clientDatabaseConnection.ExecuteAsync("UNLOCK TABLES");
                    }
                    
                    // Set the environment on the branch. This will add an entry to the history to activate the item on production after a merge has been performed. 
                    newItem.PublishedEnvironment = Environments.Development | Environments.Test | Environments.Acceptance | Environments.Live;
                    await wiserItemsService.UpdateAsync(newItem.Id, newItem, userId: userId, username: username, encryptionKey: encryptionKey, createNewTransaction: false, skipPermissionsCheck: true);
                    
                    // Add the mapping to the mappings table.
                    await databaseHelpersService.CheckAndUpdateTablesAsync(new List<string> {WiserTableNames.WiserIdMappings});
                    clientDatabaseConnection.AddParameter("tableName", $"{tablePrefix}{WiserTableNames.WiserItem}");
                    clientDatabaseConnection.AddParameter("id", newItem.Id);
                    await clientDatabaseConnection.ExecuteAsync($"INSERT INTO {WiserTableNames.WiserIdMappings} (table_name, our_id, production_id) VALUES (?tableName, ?id, ?id)");
                }
                else
                {
                    //Create the new item (with the link)
                    newItem = await wiserItemsService.CreateAsync(item, parentId, userId: userId, username: username, encryptionKey: encryptionKey, createNewTransaction: false, linkTypeNumber: linkType);
                }

                result.NewItemId = newItem.EncryptedId;
                result.NewItemIdPlain = newItem.Id;

                clientDatabaseConnection.AddParameter("entityType", newItem.EntityType);
                var dataTable = await clientDatabaseConnection.GetAsync($"SELECT icon FROM {WiserTableNames.WiserEntity} WHERE name = ?entityType");
                if (dataTable.Rows.Count > 0)
                {
                    result.Icon = dataTable.Rows[0].Field<string>("icon");
                }

                if (newItem.Details != null && newItem.Details.Any() && !createInBothDatabases)
                {
                    // Note: skipPermissionsCheck is set to true here, because otherwise the update permissions will be checked,
                    // but this is for creating an item and those permissions are already checked in the CreateAsync method that we call above.
                    await wiserItemsService.UpdateAsync(newItem.Id, newItem, userId: userId, username: username, encryptionKey: encryptionKey, createNewTransaction: false, skipPermissionsCheck: true);
                }

                await clientDatabaseConnection.CommitTransactionAsync(false);
            }
            catch (InvalidAccessPermissionsException exception)
            {
                return new ServiceResult<CreateItemResultModel>
                {
                    ErrorMessage = exception.Message,
                    StatusCode = HttpStatusCode.Forbidden
                };
            }
            catch
            {
                await clientDatabaseConnection.RollbackTransactionAsync(false);
                throw;
            }

            return new ServiceResult<CreateItemResultModel>(result);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<WiserItemModel>> UpdateAsync(string encryptedId, WiserItemModel item, ClaimsIdentity identity)
        {
            if (String.IsNullOrWhiteSpace(encryptedId))
            {
                throw new ArgumentNullException(nameof(encryptedId));
            }

            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var username = IdentityHelpers.GetUserName(identity, true);
            var itemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);
            if (itemId <= 0)
            {
                return new ServiceResult<WiserItemModel>
                {
                    StatusCode = HttpStatusCode.BadRequest,
                    ErrorMessage = "Id must be greater than zero."
                };
            }

            var tenant = await wiserTenantsService.GetSingleAsync(identity);
            var encryptionKey = tenant.ModelObject.EncryptionKey;

            try
            {
                item = await wiserItemsService.UpdateAsync(itemId, item, userId, username, encryptionKey);
            }
            catch (InvalidAccessPermissionsException exception)
            {
                return new ServiceResult<WiserItemModel>
                {
                    ErrorMessage = exception.Message,
                    StatusCode = HttpStatusCode.Forbidden
                };
            }
            catch (ArgumentOutOfRangeException exception)
            {
                return new ServiceResult<WiserItemModel>
                {
                    ErrorMessage = exception.Message,
                    StatusCode = HttpStatusCode.Conflict
                };
            }

            return new ServiceResult<WiserItemModel>(item);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<bool>> DeleteAsync(string encryptedId, ClaimsIdentity identity, bool undelete = false, string entityType = null)
        {
            if (String.IsNullOrWhiteSpace(encryptedId))
            {
                throw new ArgumentNullException(nameof(encryptedId));
            }

            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var username = IdentityHelpers.GetUserName(identity, true);
            var itemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);
            if (itemId <= 0)
            {
                throw new ArgumentException("Id must be greater than zero.");
            }

            try
            {
                await wiserItemsService.DeleteAsync(itemId, undelete, username, userId, entityType: entityType);
            }
            catch (InvalidAccessPermissionsException exception)
            {
                return new ServiceResult<bool>
                {
                    ErrorMessage = exception.Message,
                    StatusCode = HttpStatusCode.Forbidden
                };
            }
            catch (InvalidOperationException)
            {
                return new ServiceResult<bool>
                {
                    ErrorMessage = "Het is niet mogelijk om dit item te verwijderen.",
                    StatusCode = HttpStatusCode.Conflict
                };
            }

            return new ServiceResult<bool>
            {
                StatusCode = HttpStatusCode.NoContent
            };
        }

        /// <inheritdoc />
        public async Task<ServiceResult<bool>> ExecuteWorkflowAsync(string encryptedId, bool isNewItem, ClaimsIdentity identity, WiserItemModel item = null)
        {
            if (String.IsNullOrWhiteSpace(encryptedId))
            {
                throw new ArgumentNullException(nameof(encryptedId));
            }

            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            clientDatabaseConnection.SetCommandTimeout(600);
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var username = IdentityHelpers.GetUserName(identity, true);
            var itemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);
            if (itemId <= 0)
            {
                throw new ArgumentException("Id must be greater than zero.");
            }

            var (success, errorMessage, _) = await wiserItemsService.CheckIfEntityActionIsPossibleAsync(itemId, isNewItem ? EntityActions.Create : EntityActions.Update, IdentityHelpers.GetWiserUserId(identity), item);
            if (!success)
            {
                return new ServiceResult<bool>
                {
                    ErrorMessage = errorMessage,
                    StatusCode = HttpStatusCode.Forbidden
                };
            }

            if (String.IsNullOrWhiteSpace(item?.EntityType))
            {
                var newItem = await wiserItemsService.GetItemDetailsAsync(itemId, skipPermissionsCheck: true);
                if (item == null)
                {
                    item = newItem;
                }
                else
                {
                    item.EntityType = newItem.EntityType;
                }
            }

            var entityTypeSettings = await wiserItemsService.GetEntityTypeSettingsAsync(item.EntityType, item.ModuleId);
            var result = await wiserItemsService.ExecuteWorkflowAsync(itemId, isNewItem, entityTypeSettings, item, userId, username);

            return new ServiceResult<bool>(result);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<string>> GetCustomQueryAsync(int propertyId, int queryId, ClaimsIdentity identity)
        {
            if (propertyId <= 0 && queryId <= 0)
            {
                throw new ArgumentException("queryId or propertyId must be greater than zero.");
            }

            ServiceResult<string> errorResult = null;
            string customQuery;

            // Get the query of the action button that will eventually need to be executed.
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            clientDatabaseConnection.ClearParameters();

            if (queryId <= 0)
            {
                var result = await GetPropertyQueryAsync<string>(propertyId, "action_query", false);
                customQuery = result.Query;
                errorResult = result.ErrorResult;

                // If action query is empty, try data query.
                if (String.IsNullOrWhiteSpace(customQuery))
                {
                    result = await GetPropertyQueryAsync<string>(propertyId, "data_query", false);
                    customQuery = result.Query;
                    errorResult = result.ErrorResult;
                }
            }
            else
            {
                clientDatabaseConnection.AddParameter("queryId", queryId);
                var query = $"SELECT query FROM {WiserTableNames.WiserQuery} WHERE id = ?queryId";
                var dataTable = await clientDatabaseConnection.GetAsync(query);
                if (dataTable.Rows.Count == 0)
                {
                    return new ServiceResult<string>
                    {
                        StatusCode = HttpStatusCode.NotFound,
                        ErrorMessage = "Query ID does not exist or query not found."
                    };
                }

                customQuery = dataTable.Rows[0].Field<string>("query");
                if (String.IsNullOrWhiteSpace(customQuery))
                {
                    errorResult = new ServiceResult<string>
                    {
                        StatusCode = HttpStatusCode.NotFound,
                        ErrorMessage = "Data query is empty!"
                    };
                }
            }

            return errorResult ?? new ServiceResult<string>(customQuery);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<ActionButtonResultModel>> ExecuteCustomQueryAsync(string encryptedId, int propertyId, Dictionary<string, object> extraParameters, string encryptedQueryId, ClaimsIdentity identity, ulong itemLinkId = 0)
        {
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            clientDatabaseConnection.SetCommandTimeout(600);
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var username = IdentityHelpers.GetUserName(identity, true);
            var userEmailAddress = IdentityHelpers.GetEmailAddress(identity);
            var userType = IdentityHelpers.GetRoles(identity);
            var queryId = await wiserTenantsService.DecryptValue<int>(encryptedQueryId, identity);
            var itemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);

            var customQueryResult = await GetCustomQueryAsync(propertyId, queryId, identity);
            if (customQueryResult.StatusCode != HttpStatusCode.OK)
            {
                return new ServiceResult<ActionButtonResultModel>
                {
                    StatusCode = customQueryResult.StatusCode,
                    ErrorMessage = customQueryResult.ErrorMessage
                };
            }

            var actionQuery = customQueryResult.ModelObject;

            // Get the query for getting all the details of a single item.
            var detailsQuery = (await templatesService.GetQueryAsync(0, "GET_ITEM_DETAILS"))?.ModelObject?.Content;
            if (String.IsNullOrWhiteSpace(detailsQuery))
            {
                return new ServiceResult<ActionButtonResultModel>
                {
                    StatusCode = HttpStatusCode.NotFound,
                    ErrorMessage = "Query 'GET_ITEM_DETAILS' not found or empty."
                };
            }

            actionQuery = actionQuery.Replace("{userId}", userId.ToString(), StringComparison.OrdinalIgnoreCase);
            actionQuery = actionQuery.Replace("{username}", (username ?? "").ToMySqlSafeValue(false), StringComparison.OrdinalIgnoreCase);
            actionQuery = actionQuery.Replace("{userEmailAddress}", (userEmailAddress ?? "").ToMySqlSafeValue(false), StringComparison.OrdinalIgnoreCase);
            actionQuery = actionQuery.Replace("{itemLinkId}", itemLinkId.ToString(), StringComparison.OrdinalIgnoreCase);
            actionQuery = actionQuery.Replace("{userType}", (userType ?? "").ToMySqlSafeValue(false), StringComparison.OrdinalIgnoreCase);
            actionQuery = actionQuery.Replace("{encryptedId}", encryptedId.ToMySqlSafeValue(false), StringComparison.OrdinalIgnoreCase);
            actionQuery = actionQuery.Replace("'{itemId}'", "?itemId", StringComparison.OrdinalIgnoreCase).Replace("{itemId}", "?itemId", StringComparison.OrdinalIgnoreCase);
            actionQuery = apiReplacementsService.DoIdentityReplacements(actionQuery, identity, true);

            detailsQuery = detailsQuery.Replace("{itemId:decrypt(true)}", "?itemId", StringComparison.OrdinalIgnoreCase);
            detailsQuery = apiReplacementsService.DoIdentityReplacements(detailsQuery, identity, true);

            // Execute the query to get the details of the current item.
            clientDatabaseConnection.AddParameter("itemId", itemId);
            var dataTable = await clientDatabaseConnection.GetAsync(detailsQuery);

            // These are parameters that the user can enter values for in Wiser.
            if (extraParameters != null)
            {
                foreach (var parameter in extraParameters)
                {
                    string value;
                    if (parameter.Value == null)
                    {
                        value = "";
                    }
                    else
                    {
                        switch (parameter.Value)
                        {
                            case DateTime dateTimeValue:
                                value = dateTimeValue.ToString("yyyy-MM-dd HH:mm:ss");
                                break;
                            case decimal decimalValue:
                                value = decimalValue.ToString(new CultureInfo("en-US"));
                                break;
                            case JArray jArrayValue:
                                try
                                {
                                    value = String.Join(",", jArrayValue.Values<string>());
                                }
                                catch
                                {
                                    value = jArrayValue.ToString();
                                }
                                
                                break;
                            default:
                                value = parameter.Value.ToString().ToMySqlSafeValue(false);
                                break;
                        }
                    }

                    actionQuery = actionQuery.Replace($"{{{parameter.Key.ToMySqlSafeValue(false)}}}", value.ToMySqlSafeValue(false), StringComparison.OrdinalIgnoreCase);
                }
            }
            
            // Perform replacement for extra parameters.
            actionQuery = stringReplacementsService.DoReplacements(actionQuery, extraParameters, forQuery: true);

            // Do replacements on the data query with the details of the current item.
            if (dataTable.Rows.Count > 0)
            {
                var firstRow = dataTable.Rows[0];
                actionQuery = actionQuery.Replace("{itemTitle}", firstRow.Field<string>("title").ToMySqlSafeValue(false), StringComparison.OrdinalIgnoreCase);
                actionQuery = actionQuery.Replace("{environment}", firstRow["published_environment"].ToString().ToMySqlSafeValue(false), StringComparison.OrdinalIgnoreCase);
                actionQuery = actionQuery.Replace("{entityType}", firstRow.Field<string>("entity_type").ToMySqlSafeValue(false), StringComparison.OrdinalIgnoreCase);

                foreach (DataRow dataRow in dataTable.Rows)
                {
                    actionQuery = actionQuery.Replace($"{{{dataRow.Field<string>("property_name").ToMySqlSafeValue(false)}}}", dataRow.Field<string>("property_value").ToMySqlSafeValue(false), StringComparison.OrdinalIgnoreCase);
                }
            }

            // And finally execute the action button query.
            try
            {
                // Set session variables with username and user id. These will be used in triggers for keeping track of the change history.
                clientDatabaseConnection.AddParameter("username", username);
                clientDatabaseConnection.AddParameter("userId", userId);
                dataTable = await clientDatabaseConnection.GetAsync($@"SET @_username = ?username;
                                                                    SET @_userId = ?userId;
                                                                    {actionQuery}");
            }
            catch (MySqlException mySqlException)
            {
                if (mySqlException.Number != 1062)
                {
                    throw;
                }

                return new ServiceResult<ActionButtonResultModel>
                {
                    StatusCode = HttpStatusCode.BadRequest,
                    ErrorMessage = "Dit item bestaat al en kan niet nogmaals toegevoegd worden."
                };
            }

            var itemIdResult = "";
            var linkIdResult = 0;
            var success = true;
            var errorMessage = "";
            var otherData = new JArray();
            if (dataTable.Rows.Count > 0)
            {
                if (dataTable.Columns.Contains("itemId") && !dataTable.Rows[0].IsNull("itemId"))
                {
                    itemIdResult = dataTable.Rows[0]["itemId"].ToString();
                    if (Int32.TryParse(itemIdResult, out var parsedItemId))
                    {
                        itemIdResult = await wiserTenantsService.EncryptValue(parsedItemId, identity);
                    }
                }
                if (dataTable.Columns.Contains("linkId") && !dataTable.Rows[0].IsNull("linkId"))
                {
                    linkIdResult = Convert.ToInt32(dataTable.Rows[0]["linkId"]);
                }
                if (dataTable.Columns.Contains("success") && !dataTable.Rows[0].IsNull("success"))
                {
                    success = Convert.ToBoolean(dataTable.Rows[0]["success"]);
                }
                if (dataTable.Columns.Contains("message") && !dataTable.Rows[0].IsNull("message"))
                {
                    errorMessage = dataTable.Rows[0].Field<string>("message");
                }

                if (dataTable.Rows.Count > 0)
                {
                    var tenant = await wiserTenantsService.GetSingleAsync(identity);
                    var encryptionKey = tenant.ModelObject.EncryptionKey;
                    otherData = dataTable.ToJsonArray(encryptionKey, allowValueDecryption: true);
                }
            }

            return new ServiceResult<ActionButtonResultModel>(new ActionButtonResultModel
            {
                ItemId = itemIdResult,
                LinkId = linkIdResult,
                OtherData = otherData,
                Success = success,
                ErrorMessage = errorMessage
            });
        }

        /// <inheritdoc />
        public async Task<ServiceResult<ItemHtmlAndScriptModel>> GetItemHtmlAsync(string encryptedId, ClaimsIdentity identity, string propertyIdSuffix = null, ulong itemLinkId = 0, string entityType = null, int linkType = 0)
        {
            var results = new ItemHtmlAndScriptModel();
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var itemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);

            if (itemId == 0)
            {
                return new ServiceResult<ItemHtmlAndScriptModel>(results)
                {
                    StatusCode = HttpStatusCode.BadRequest,
                    ErrorMessage = "Invalid item ID."
                };
            }

            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var (success, _, userItemPermissions) = await wiserItemsService.CheckIfEntityActionIsPossibleAsync(itemId, EntityActions.Read, IdentityHelpers.GetWiserUserId(identity), onlyCheckAccessRights: true, entityType: entityType);

            // If the user is not allowed to read this item, return an empty result.
            if (!success)
            {
                return new ServiceResult<ItemHtmlAndScriptModel>(results);
            }

            var tablePrefix = await wiserItemsService.GetTablePrefixForEntityAsync(entityType);
            var linkTablePrefix = await wiserItemsService.GetTablePrefixForLinkAsync(linkType);
            var wiserItemFileTable = WiserTableNames.WiserItemFile;
            var wiserItemFileTableForLink = WiserTableNames.WiserItemFile;
            if (!String.IsNullOrWhiteSpace(tablePrefix) && await databaseHelpersService.TableExistsAsync($"{tablePrefix}{WiserTableNames.WiserItemFile}"))
            {
                wiserItemFileTable = $"{tablePrefix}{WiserTableNames.WiserItemFile}";
            }
            if (!String.IsNullOrWhiteSpace(linkTablePrefix) && await databaseHelpersService.TableExistsAsync($"{linkTablePrefix}{WiserTableNames.WiserItemFile}"))
            {
                wiserItemFileTableForLink = $"{linkTablePrefix}{WiserTableNames.WiserItemFile}";
            }

            results.CanRead = (userItemPermissions & AccessRights.Read) == AccessRights.Read;
            results.CanCreate = (userItemPermissions & AccessRights.Create) == AccessRights.Create;
            results.CanWrite = (userItemPermissions & AccessRights.Update) == AccessRights.Update;
            results.CanDelete = (userItemPermissions & AccessRights.Delete) == AccessRights.Delete;

            clientDatabaseConnection.ClearParameters();
            clientDatabaseConnection.AddParameter("itemId", itemId);
            clientDatabaseConnection.AddParameter("userId", userId);
            clientDatabaseConnection.AddParameter("itemLinkId", itemLinkId);

            var itemIsFromArchive = false;
            var query = $@"SET SESSION group_concat_max_len = 1000000;
                                SELECT e.tab_name, e.group_name, e.inputtype AS field_type, t.html_template, e.display_name, e.property_name, e.options, e.module_id,
    	                            e.explanation, d.long_value, d.`value`, e.default_value, e.id, e.width, e.height, e.css, e.extended_explanation, e.label_style, e.label_width, e.access_key,
    	                            e.depends_on_field, e.depends_on_operator, e.depends_on_value, IFNULL(e.depends_on_action, 'toggle-visibility') AS depends_on_action, e.ordering, t.script_template,
    	                            e.save_on_change, files.JSON AS filesJSON, 0 AS itemLinkId, e.regex_validation, e.mandatory, e.language_code,
    	                            # A user can have multiple roles. So we need to check if they have at least one role that has update rights. If it doesn't, then the field should be readonly.
    	                            IF(e.readonly > 0 OR i.readonly > 0 OR SUM(IF(permission.permissions IS NULL OR (permission.permissions & 4) > 0, 1, 0)) = 0, TRUE, FALSE) AS readonly,
    	                            e.custom_script, permission.permissions, i.readonly AS itemIsReadOnly, e.visibility_path_regex, e.enable_aggregation
                                FROM {WiserTableNames.WiserEntityProperty} e
                                JOIN {tablePrefix}{WiserTableNames.WiserItem}{{0}} i ON i.id = ?itemId AND i.entity_type = e.entity_name
                                LEFT JOIN {WiserTableNames.WiserFieldTemplates} t ON t.field_type = e.inputtype
                                LEFT JOIN {tablePrefix}{WiserTableNames.WiserItemDetail}{{0}} d ON d.item_id = ?itemId AND ((e.property_name IS NOT NULL AND e.property_name <> '' AND d.`key` = e.property_name) OR ((e.property_name IS NULL OR e.property_name = '') AND d.`key` = e.display_name)) AND d.language_code = e.language_code
                                # TODO: Find a more efficient way to load images and files?
                                LEFT JOIN (
                                    SELECT item_id, property_name, CONCAT('[', GROUP_CONCAT(JSON_OBJECT('itemId', item_id, 'itemLinkId', itemlink_id, 'fileId', id, 'name', REPLACE(file_name, '/', '-'), 'title', title, 'extension', extension, 'size', IFNULL(OCTET_LENGTH(content), 0), 'addedOn', added_on, 'contentUrl', IFNULL(content_url, ''), 'extraData', extra_data) ORDER BY ordering ASC), ']') AS json
                                    FROM {wiserItemFileTable}{{0}}
                                    WHERE item_id = ?itemId
                                    GROUP BY property_name
                                ) files ON files.item_id = i.id AND ((e.property_name IS NOT NULL AND e.property_name <> '' AND files.property_name = e.property_name) OR ((e.property_name IS NULL OR e.property_name = '') AND files.property_name = e.display_name))

                                # Check permissions
                                LEFT JOIN (
                                    SELECT permission.permissions, permission.entity_property_id
                                    FROM {WiserTableNames.WiserUserRoles} userRole
                                    JOIN {WiserTableNames.WiserRoles} role ON role.id = userRole.role_id
                                    JOIN {WiserTableNames.WiserPermission} permission ON permission.role_id = role.id AND permission.entity_property_id > 0
                                    WHERE userRole.user_id = ?userId
                                ) permission ON permission.entity_property_id = e.id OR permission.entity_property_id IS NULL

                                WHERE permission.permissions IS NULL OR permission.permissions > 0
                                GROUP BY id
                                
                                UNION ALL
                                
                                SELECT 'Velden vanuit koppeling' AS tab_name, e.group_name, e.inputtype AS field_type, t.html_template, e.display_name, e.property_name, e.options, e.module_id,
    	                            e.explanation, d.long_value, d.`value`, e.default_value, e.id, e.width, e.height, e.css, e.extended_explanation, e.label_style, e.label_width, e.access_key,
    	                            e.depends_on_field, e.depends_on_operator, e.depends_on_value, IFNULL(e.depends_on_action, 'toggle-visibility') AS depends_on_action, e.ordering, t.script_template,
    	                            e.save_on_change, files.JSON AS filesJSON, il.id AS itemLinkId, e.regex_validation, e.mandatory, e.language_code,
    	                            # A user can have multiple roles. So we need to check if they have at least one role that has update rights. If it doesn't, then the field should be readonly.
    	                            IF(e.readonly > 0 OR SUM(IF(permission.permissions IS NULL OR (permission.permissions & 4) > 0, 1, 0)) = 0, TRUE, FALSE) AS readonly, 
    	                            e.custom_script, permission.permissions, i.readonly AS itemIsReadOnly, e.visibility_path_regex, e.enable_aggregation
                                FROM {WiserTableNames.WiserEntityProperty} e
                                JOIN {tablePrefix}{WiserTableNames.WiserItem}{{0}} i ON i.id = ?itemId
                                JOIN {linkTablePrefix}{WiserTableNames.WiserItemLink}{{0}} il ON il.id = ?itemLinkId AND il.type = e.link_type
                                LEFT JOIN {WiserTableNames.WiserFieldTemplates} t ON t.field_type = e.inputtype
                                LEFT JOIN {linkTablePrefix}{WiserTableNames.WiserItemLinkDetail}{{0}} d ON d.itemlink_id = ?itemLinkId AND ((e.property_name IS NOT NULL AND e.property_name <> '' AND d.`key` = e.property_name) OR ((e.property_name IS NULL OR e.property_name = '') AND d.`key` = e.display_name)) AND d.language_code = e.language_code
                                # TODO: Find a more efficient way to load images and files?
                                LEFT JOIN (
                                    SELECT itemlink_id, property_name, CONCAT('[', GROUP_CONCAT(JSON_OBJECT('itemId', item_id, 'itemLinkId', itemlink_id, 'fileId', id, 'name', REPLACE(file_name, '/', '-'), 'title', title, 'extension', extension, 'size', IFNULL(OCTET_LENGTH(content), 0), 'addedOn', added_on, 'contentUrl', IFNULL(content_url, ''), 'extraData', extra_data) ORDER BY ordering ASC), ']') AS json
                                    FROM {wiserItemFileTableForLink}{{0}}
                                    WHERE itemlink_id = ?itemLinkId
                                    GROUP BY property_name
                                ) files ON files.itemlink_id = il.id AND ((e.property_name IS NOT NULL AND e.property_name <> '' AND files.property_name = e.property_name) OR ((e.property_name IS NULL OR e.property_name = '') AND files.property_name = e.display_name))

                                # Check persmissions
                                LEFT JOIN (
                                    SELECT permission.permissions, permission.entity_property_id
                                    FROM {WiserTableNames.WiserUserRoles} userRole
                                    JOIN {WiserTableNames.WiserRoles} role ON role.id = userRole.role_id
                                    JOIN {WiserTableNames.WiserPermission} permission ON permission.role_id = role.id AND permission.entity_property_id > 0
                                    WHERE userRole.user_id = ?userId
                                ) permission ON permission.entity_property_id = e.id OR permission.entity_property_id IS NULL

                                WHERE e.link_type > 0 AND (permission.permissions IS NULL OR permission.permissions > 0)
                                GROUP BY id
                                
                                ORDER BY ordering";

            // First check the normal wiser_item table.
            var dataTable = await clientDatabaseConnection.GetAsync(String.Format(query, ""));

            if (dataTable.Rows.Count == 0)
            {
                // If the item was not found in the normal table, check the archive table.
                dataTable = await clientDatabaseConnection.GetAsync(String.Format(query, WiserTableNames.ArchiveSuffix));

                if (dataTable.Rows.Count == 0)
                {
                    // If the item still isn't found, return an empty result.
                    return new ServiceResult<ItemHtmlAndScriptModel>(results);
                }

                itemIsFromArchive = true;
            }

            if (itemIsFromArchive || Convert.ToBoolean(dataTable.Rows[0]["itemIsReadOnly"]))
            {
                results.CanCreate = false;
                results.CanWrite = false;
                results.CanDelete = false;
            }

            var tenant = await wiserTenantsService.GetSingleAsync(identity);
            var encryptionKey = tenant.ModelObject.EncryptionKey;

            // New aggregation method, check if any of the fields are aggregated, if so fill the values from the item table
            if (dataTable.AsEnumerable().Any(row => Convert.ToInt32(row["enable_aggregation"]) == 2))
            {
                //TODO:get only the selection of fields in this query
                clientDatabaseConnection.ClearParameters();
                clientDatabaseConnection.AddParameter("itemId", itemId);
                var itemQuery = $@"SET SESSION group_concat_max_len = 1000000;
                                SELECT *
                                FROM {tablePrefix}{WiserTableNames.WiserItem}{{0}} i
                                WHERE i.id = ?itemId";
                var aggregatedFieldsTable = await clientDatabaseConnection.GetAsync(String.Format(itemQuery, (itemIsFromArchive ? WiserTableNames.ArchiveSuffix : "")), skipCache:true);
                
                //Neem velden over
                var rowsToUpdate = dataTable.AsEnumerable()
                    .Where(row => Convert.ToInt32(row["enable_aggregation"]) == 2)
                    .Where(row => aggregatedFieldsTable.Columns.Contains(row.Field<string>("property_name")));
                
                foreach (var row in rowsToUpdate)
                {
                    var fieldName = row.Field<string>("property_name");
                    row["value"] = aggregatedFieldsTable.Rows[0][fieldName]; //TODO:check gaat dit goed bij grote velden > 1000 tekens?
                }
            }
            
            var dataRows = dataTable.Rows;
            var fieldTemplates = new Dictionary<string, string>();
            foreach (DataRow dataRow in dataRows)
            {
                // Get or create the object for the current tab.
                var tabName = dataRow.Field<string>("tab_name");
                var tab = results.Tabs.FirstOrDefault(r => r.Name.Equals(tabName, StringComparison.OrdinalIgnoreCase));
                if (tab == null)
                {
                    tab = new ItemTabOrGroupModel { Name = tabName };
                    results.Tabs.Add(tab);
                }

                var groupName = dataRow.Field<string>("group_name") ?? "";
                var group = tab.Groups.FirstOrDefault(g => g.Name.Equals(groupName, StringComparison.OrdinalIgnoreCase));
                if (group == null)
                {
                    group = new ItemTabOrGroupModel { Name = groupName };
                    tab.Groups.Add(group);
                }

                // Get values from data row that we'll need later.
                var htmlTemplate = dataRow.Field<string>("html_template");
                var scriptTemplate = dataRow.Field<string>("script_template");
                var fieldType = dataRow.Field<string>("field_type");
                var isReadOnly = Convert.ToBoolean(dataRow["readonly"]) || (userItemPermissions & AccessRights.Update) != AccessRights.Update;

                // Get mode, some fields have different modes and need different HTML for different modes.
                var options = dataRow.Field<string>("options")?.Replace("{itemId}", itemId.ToString(), StringComparison.OrdinalIgnoreCase);
                var optionsObject = JObject.Parse(String.IsNullOrWhiteSpace(options) ? "{}" : options);

                //Manipulate customActions based on Role if necessary
                if (fieldType == "sub-entities-grid")
                {
                    if (optionsObject.ContainsKey("toolbar"))
                    {
                        var toolbar = optionsObject.Value<JObject>("toolbar");
                        if (toolbar.ContainsKey("customActions"))
                        {
                            var customActions = toolbar.Value<JArray>("customActions");
                            var deletedCustomActions = new List<JToken>();
                            foreach (var customAction in customActions)
                            {
                                var rolesToken = customAction.SelectToken("roles");
                                if (rolesToken == null) continue; // No roles defined = access

                                var roles = rolesToken.Values<string>().ToList();
                                var hasRole = false;
                                foreach (var role in roles)
                                {
                                    if (IdentityHelpers.HasRole(identity, role)) hasRole = true;
                                }
                                if (hasRole) continue;
                                deletedCustomActions.Add(customAction);
                            }

                            foreach (var deletedCustomAction in deletedCustomActions)
                            {
                                customActions.Remove(deletedCustomAction);
                            }
                        }
                    }
                }
                var fieldMode = "";
                var containerCssClasses = new List<string>();
                if (optionsObject.ContainsKey("mode"))
                {
                    fieldMode = optionsObject.Value<string>("mode");
                }

                switch (fieldMode)
                {
                    case "switch":
                        containerCssClasses.Add("checkbox-adv");
                        containerCssClasses.Add("large");
                        break;
                    case "checkBoxGroup":
                        containerCssClasses.Add("row");
                        containerCssClasses.Add("checkbox-full-container");
                        break;
                }

                if (isReadOnly)
                {
                    containerCssClasses.Add("readonly");
                }

                if (String.IsNullOrWhiteSpace(htmlTemplate))
                {
                    var nameWithoutMode = $"{fieldType}.html";
                    var name = $"{fieldType}{(String.IsNullOrWhiteSpace(fieldMode) ? "" : $"-{fieldMode}")}.html";

                    if (!fieldTemplates.ContainsKey(name))
                    {
                        var contents = ReadTextResourceFromAssembly(name);
                        if (!String.IsNullOrWhiteSpace(contents))
                        {
                            fieldTemplates.Add(name, contents);
                        }
                        else if (fieldTemplates.ContainsKey(nameWithoutMode))
                        {
                            name = nameWithoutMode;
                        }
                        else
                        {
                            if (String.IsNullOrWhiteSpace(contents))
                            {
                                name = nameWithoutMode;
                                contents = ReadTextResourceFromAssembly(name);
                            }

                            fieldTemplates.Add(name, contents);
                        }
                    }

                    htmlTemplate = fieldTemplates[name];
                }
                if (String.IsNullOrWhiteSpace(scriptTemplate))
                {
                    var name = $"{fieldType}.js";
                    if (!fieldTemplates.ContainsKey(name))
                    {
                        fieldTemplates.Add(name, ReadTextResourceFromAssembly(name));
                    }

                    scriptTemplate = fieldTemplates[name];
                }

                var displayName = dataRow.Field<string>("display_name");
                var propertyName = dataRow.Field<string>("property_name");
                var longValue = dataRow.Field<string>("long_value");
                var value = dataRow.Field<string>("value");
                var defaultValue = dataRow.Field<string>("default_value") ?? "";
                var propertyId = dataRow.Field<int>("id");
                var width = dataRow.Field<short>("width");
                var height = dataRow.Field<short>("height");
                var regExValidation = dataRow.Field<string>("regex_validation");
                var filesJson = dataRow.Field<string>("filesJSON");
                var languageCode = dataRow.Field<string>("language_code") ?? "";
                var explanation = dataRow.Field<string>("explanation") ?? "";
                var hasExtendedExplanation = !String.IsNullOrWhiteSpace(explanation) && Convert.ToBoolean(dataRow["extended_explanation"]);
                var labelStyle = dataRow.Field<string>("label_style") ?? "";
                var labelWidth = labelStyle == "normal" ? "0" : dataRow.Field<string>("label_width") ?? "";
                var accessKey = dataRow.Field<string>("access_key") ?? "";
                var visibilityPathRegex = dataRow.Field<string>("visibility_path_regex") ?? "";

                if (!String.IsNullOrWhiteSpace(filesJson))
                {
                    var parsedFilesJson = JToken.Parse(filesJson);
                    jsonService.EncryptValuesInJson(parsedFilesJson, encryptionKey, new List<string> { "itemId" });
                    filesJson = parsedFilesJson.ToString();

                    // Fix the ordering of the files in this field, to prevent problems with changing the ordering later.
                    await filesService.FixOrderingAsync(itemId, itemLinkId, propertyName, identity);
                }

                var extraAttributes = "";
                var containerCss = dataRow.Field<string>("css") ?? "";
                var elementCss = "";
                var fieldContainerCss = "";
                var fieldErrorContainerCss = "";
                var fieldErrorMessage = "";
                var inputType = GclCoreConstants.DefaultInputType;

                // Setup any extra attributes.
                switch (fieldType.ToLowerInvariant())
                {
                    case "checkbox":
                        if ((!String.IsNullOrWhiteSpace(value) && Int32.TryParse(value, out var intValue) && intValue > 0) || (String.IsNullOrWhiteSpace(value) && Int32.TryParse(defaultValue, out intValue) && intValue > 0))
                        {
                            extraAttributes = "checked";
                        }
                        break;
                    case "secure-input":
                        if (value == null)
                        {
                            break;
                        }

                        var securityMethod = "JCL_SHA512";

                        if (optionsObject.ContainsKey(GclCoreConstants.SecurityMethodKey))
                        {
                            securityMethod = optionsObject[GclCoreConstants.SecurityMethodKey]?.ToString()?.ToUpperInvariant();
                        }

                        var securityKey = "";
                        if (securityMethod.InList("JCL_AES", "AES"))
                        {
                            if (optionsObject.ContainsKey(GclCoreConstants.SecurityKeyKey))
                            {
                                securityKey = optionsObject[GclCoreConstants.SecurityKeyKey]?.ToString();
                            }

                            if (String.IsNullOrEmpty(securityKey))
                            {
                                securityKey = encryptionKey;
                            }
                        }

                        switch (securityMethod)
                        {
                            case "JCL_AES":
                                try
                                {
                                    value = value.DecryptWithAesWithSalt(securityKey);
                                }
                                catch (Exception exception)
                                {
                                    logger.LogError($"Error while trying to decrypt value '{value}' for field '{propertyName}': {exception}");
                                }
                                break;
                            case "AES":
                                try
                                {
                                    value = value.DecryptWithAes(securityKey);
                                }
                                catch (Exception exception)
                                {
                                    logger.LogError($"Error while trying to decrypt value '{value}' for field '{propertyName}': {exception}");
                                }
                                break;
                        }

                        break;

                    case "numeric-input":
                        if (String.IsNullOrWhiteSpace(value))
                        {
                            break;
                        }

                        // Make sure that the decimal is in the correct culture that is set in the field. The default culture is nl-NL.
                        var culture = optionsObject[GclCoreConstants.CultureKey]?.ToString();
                        if (String.IsNullOrWhiteSpace(culture))
                        {
                            culture = "nl-NL";
                        }

                        Decimal.TryParse(value.Replace(",", "."), NumberStyles.Any, new CultureInfo("en-US"), out var decimalValue);
                        value = decimalValue.ToString(new CultureInfo(culture));

                        break;

                    case "qr":
                        {
                            var customQueryResult = await ExecuteCustomQueryAsync(encryptedId, propertyId, new Dictionary<string, object>(), await wiserTenantsService.EncryptValue("0", identity), identity, userId);
                            var property = (JProperty)customQueryResult?.ModelObject?.OtherData?.FirstOrDefault()?.FirstOrDefault();
                            if (!String.IsNullOrWhiteSpace(property?.Name))
                            {
                                var size = 0;
                                if (optionsObject.ContainsKey(GclCoreConstants.SizeKey))
                                {
                                    size = optionsObject[GclCoreConstants.SizeKey].Value<int>();
                                }

                                if (size <= 0)
                                {
                                    size = 250;
                                }

                                var url = property.Value.Value<string>() ?? "";
                                value = $"{httpContextAccessor.HttpContext.Request.Scheme}://{httpContextAccessor.HttpContext.Request.Host.Value}/api/v3/barcodes/qr?text={Uri.EscapeDataString(url)}&size={size}";
                            }

                            break;
                        }
                    case "htmleditor":
                        value = await wiserItemsService.ReplaceHtmlForViewingAsync(value);
                        longValue = await wiserItemsService.ReplaceHtmlForViewingAsync(longValue);
                        break;
                    case "empty":
                    case "iframe":
                        {
                            if (String.IsNullOrWhiteSpace(defaultValue))
                            {
                                break;
                            }

                            var queryId = "0";
                            if (optionsObject.TryGetValue("queryId", out var queryIdValue))
                            {
                                queryId = queryIdValue.Value<string>();
                            }

                            var customQueryResult = await ExecuteCustomQueryAsync(encryptedId, propertyId, new Dictionary<string, object>(), await wiserTenantsService.EncryptValue(queryId, identity), identity, userId);
                            if (customQueryResult.ModelObject is not { Success: true })
                            {
                                break;
                            }

                            if (customQueryResult.ModelObject.OtherData.FirstOrDefault() is not JObject jObject)
                            {
                                break;
                            }

                            value = stringReplacementsService.DoReplacements(defaultValue, jObject.ToObject<Dictionary<string, object>>());
                            break;
                        }
                }

                // Setup any extra CSS for the field.
                if (width > 0)
                    containerCss = $"width: {width}%;{containerCss}";
                if (height > 0)
                    elementCss = $"height: {height}px;";

                // Certain fields can be setup so that their value will be saved in wiser_itemlink, instead of wiser_itemdetail. we need to check for that here.
                if (optionsObject.ContainsKey("saveValueAsItemLink") && optionsObject.Value<bool>("saveValueAsItemLink"))
                {
                    var currentItemIsDestinationId = optionsObject.Value<bool>("currentItemIsDestinationId");
                    var linkTypeNumber = optionsObject.Value<int>("linkTypeNumber");
                    var limit = fieldType.Equals("combobox") ? "LIMIT 1" : "";
                    var linkTablePrefixForSaving = await wiserItemsService.GetTablePrefixForLinkAsync(linkTypeNumber);
                    var linkSettings = linkTypeNumber > 0 ? await wiserItemsService.GetLinkTypeSettingsAsync(linkTypeNumber) : new LinkSettingsModel();

                    if (fieldType.Equals("multiselect", StringComparison.OrdinalIgnoreCase) && currentItemIsDestinationId && linkSettings.UseItemParentId)
                    {
                        // Impossible combination.
                        fieldContainerCss = "display: none;";
                        fieldErrorMessage = "Het is niet mogelijk om een multiselect veld te gebruiken met de huidige instellingen.";
                    }
                    else
                    {
                        fieldErrorContainerCss = "display: none;";
                        fieldErrorMessage = "";
                    }

                    string linkValueQuery;

                    if (linkSettings.UseItemParentId)
                    {
                        linkValueQuery = $"""
                                          SELECT {(currentItemIsDestinationId ? "id" : "parent_item_id")} AS result
                                          FROM {linkTablePrefixForSaving}{WiserTableNames.WiserItem}
                                          WHERE {(currentItemIsDestinationId ? "parent_item_id" : "id")} = ?itemId AND entity_type = ?entityType
                                          {limit}
                                          """;
                    }
                    else
                    {
                        linkValueQuery = $"""
                                          SELECT {(currentItemIsDestinationId ? "item_id" : "destination_item_id")} AS result
                                          FROM {linkTablePrefixForSaving}{WiserTableNames.WiserItemLink} 
                                          WHERE {(currentItemIsDestinationId ? "destination_item_id" : "item_id")} = ?itemId 
                                          AND type = ?linkTypeNumber
                                          {limit}
                                          """;
                    }

                    clientDatabaseConnection.ClearParameters();
                    clientDatabaseConnection.AddParameter("itemId", itemId);
                    clientDatabaseConnection.AddParameter("linkTypeNumber", linkTypeNumber);
                    clientDatabaseConnection.AddParameter("entityType", currentItemIsDestinationId ? linkSettings.SourceEntityType : linkSettings.DestinationEntityType);
                    dataTable = await clientDatabaseConnection.GetAsync(linkValueQuery);
                    if (dataTable.Rows.Count > 0)
                    {
                        var rawValues = dataTable.Rows.Cast<DataRow>().Select(linkedItemDataRow => linkedItemDataRow["result"].ToString()).ToList();
                        var values = new List<ulong>();
                        foreach (var rawValue in rawValues)
                        {
                            if (UInt64.TryParse(rawValue, out var parsedValue))
                            {
                                values.Add(parsedValue);
                            }
                        }

                        defaultValue = String.Join(",", values);
                    }
                }
                else if (!String.IsNullOrWhiteSpace(longValue))
                {
                    defaultValue = longValue;
                }
                else if (!String.IsNullOrEmpty(value))
                {
                    defaultValue = value;
                }

                // Setup the input type for text fields.
                if (optionsObject.ContainsKey("type"))
                {
                    inputType = optionsObject.Value<string>("type");
                    if (String.IsNullOrWhiteSpace(inputType))
                    {
                        inputType = GclCoreConstants.DefaultInputType;
                    }
                }

                // Encrypt certain values in options JSON.
                jsonService.EncryptValuesInJson(optionsObject, encryptionKey);
                options = optionsObject.ToString(Formatting.None);
                
                // Retrieve the "Pro6PP" field value.
                string pro6PPField = optionsObject.ContainsKey("Pro6PPField") ? optionsObject["Pro6PPField"].ToString() : null;

                defaultValue = defaultValue.Replace("{itemId}", itemId.ToString()).Replace("{userId}", userId.ToString());

                // Retrieve the subdomain that is currently being used.
                string subDomain = IdentityHelpers.GetSubDomain(identity);
                
                // Retrieve the request base URL.
                HttpRequest request = httpContextAccessor.HttpContext.Request;
                string requestBaseUrl = $"{request.Scheme}://{request.Host}";
                
                // Replace values in html template.
                if (!String.IsNullOrWhiteSpace(htmlTemplate))
                {
                    string valueToReplace;
                    if (fieldType.Equals("HTMLeditor", StringComparison.OrdinalIgnoreCase) || fieldType.Equals("mail-editor", StringComparison.OrdinalIgnoreCase) || fieldType.Equals("page-builder", StringComparison.OrdinalIgnoreCase))
                    {
                        valueToReplace = defaultValue.HtmlEncode();
                    }
                    else if (fieldType.Equals("empty", StringComparison.OrdinalIgnoreCase))
                    {
                        valueToReplace = defaultValue;
                    }
                    else
                    {
                        valueToReplace = defaultValue.HtmlEncode();
                    }

                    htmlTemplate = htmlTemplate.Replace("{title}",
                            String.IsNullOrWhiteSpace(displayName) ? propertyName ?? "" : displayName)
                        .Replace("{moduleId}", (dataRow.Field<short?>("module_id") ?? 0).ToString())
                        .Replace("{hint}", explanation)
                        .Replace("{propertyId}", propertyId.ToString())
                        .Replace("{propertyIdWithSuffix}", propertyId + (propertyIdSuffix ?? ""))
                        .Replace("{propertyIdSuffix}", propertyIdSuffix ?? "")
                        .Replace("{propertyName}",
                            String.IsNullOrWhiteSpace(propertyName) ? displayName ?? "" : propertyName.Trim())
                        .Replace("{extraAttribute}", extraAttributes)
                        .Replace("{itemId}", itemId.ToString())
                        .Replace("{style}", containerCss)
                        .Replace("{fieldContainerStyle}", fieldContainerCss)
                        .Replace("{fieldErrorContainerStyle}", fieldErrorContainerCss)
                        .Replace("{style}", containerCss)
                        .Replace("{elementStyle}", elementCss)
                        .Replace("{fieldErrorMessage}", fieldErrorMessage)
                        .Replace("{itemIdEncrypted}", encryptedId.Replace(" ", "+"))
                        .Replace("{dependsOnField}", dataRow.Field<string>("depends_on_field") ?? "")
                        .Replace("{dependsOnOperator}", dataRow.Field<string>("depends_on_operator") ?? "")
                        .Replace("{dependsOnValue}", dataRow.Field<string>("depends_on_value") ?? "")
                        .Replace("{dependsOnAction}", dataRow.Field<string>("depends_on_action") ?? "")
                        .Replace("{saveOnChange}",
                            Convert.ToBoolean(dataRow["save_on_change"]).ToString().ToLowerInvariant())
                        .Replace("{itemLinkId}", dataRow["itemLinkId"]?.ToString() ?? "")
                        .Replace("{required}", Convert.ToBoolean(dataRow["mandatory"]) ? "required" : "")
                        .Replace("{readonly}", isReadOnly ? "readonly disabled" : "")
                        .Replace("{pattern}", String.IsNullOrWhiteSpace(regExValidation) ? ".*" : regExValidation)
                        .Replace("{languageCode}", languageCode)
                        .Replace("{inputType}", inputType)
                        .Replace("{width}", width <= 0 ? "50" : width.ToString())
                        .Replace("{height}", height <= 0 ? "" : height.ToString())
                        .Replace("{userId}", userId.ToString())
                        .Replace("{userItemPermissions}", ((int)userItemPermissions).ToString())
                        .Replace("{formHintClass}", hasExtendedExplanation ? "hidden" : "")
                        .Replace("{titleClass}", hasExtendedExplanation ? "tooltip" : "")
                        .Replace("{infoIconClass}", hasExtendedExplanation ? "" : "hidden")
                        .Replace("{labelStyle}", labelStyle)
                        .Replace("{labelWidth}", labelWidth)
                        .Replace("{accessKey}", accessKey)
                        .Replace("{fieldMode}", fieldMode)
                        .Replace("{visibilityPathRegex}", visibilityPathRegex)
                        .Replace("{containerCssClass}", String.Join(" ", containerCssClasses))
                        .Replace("{linkType}", linkType.ToString())
                        .Replace("{entityType}", entityType)
                        .Replace("{default_value}", valueToReplace)
                        .Replace("{subDomain}", subDomain)
                        .Replace("{baseUrl}", requestBaseUrl)
                        .Replace("{pro6pp}", pro6PPField);
                }

                // Replace values in javascript template.
                if (!String.IsNullOrWhiteSpace(scriptTemplate))
                {
                    // Replace API key for Topol.
                    if (fieldType.Equals("mail-editor", StringComparison.OrdinalIgnoreCase))
                    {
                        string topolApiKey = GclSettings.Current.TopolApiKey;

                        if (!string.IsNullOrEmpty(topolApiKey))
                            scriptTemplate = scriptTemplate.Replace("{topolApiKey}", topolApiKey);
                    }

                    scriptTemplate = scriptTemplate
                        .Replace("{customScript}", dataRow.Field<string>("custom_script") ?? "")
                        .Replace("{propertyId}", propertyId.ToString())
                        .Replace("{propertyIdWithSuffix}", propertyId + (propertyIdSuffix ?? ""))
                        .Replace("{propertyIdSuffix}", propertyIdSuffix ?? "")
                        .Replace("{itemId}", itemId.ToString())
                        .Replace("{itemIdEncrypted}", encryptedId.Replace(" ", "+"))
                        .Replace("{moduleId}", (dataRow.Field<short?>("module_id") ?? 0).ToString())
                        .Replace("{options}", String.IsNullOrWhiteSpace(options) ? "{}" : options)
                        .Replace("{initialFiles}", String.IsNullOrWhiteSpace(filesJson) ? "[]" : filesJson)
                        .Replace("{propertyName}",
                            String.IsNullOrWhiteSpace(propertyName) ? displayName ?? "" : propertyName.Trim())
                        .Replace("{title}", String.IsNullOrWhiteSpace(displayName) ? propertyName ?? "" : displayName)
                        .Replace("{dependsOnField}", dataRow.Field<string>("depends_on_field") ?? "")
                        .Replace("{dependsOnOperator}", dataRow.Field<string>("depends_on_operator") ?? "")
                        .Replace("{dependsOnValue}", dataRow.Field<string>("depends_on_value") ?? "")
                        .Replace("{saveOnChange}",
                            Convert.ToBoolean(dataRow["save_on_change"]).ToString().ToLowerInvariant())
                        .Replace("{itemLinkId}", dataRow["itemLinkId"]?.ToString() ?? "")
                        .Replace("{languageCode}", languageCode)
                        .Replace("{readonly}",
                            (Convert.ToBoolean(dataRow["readonly"]) ||
                             (userItemPermissions & AccessRights.Update) != AccessRights.Update).ToString()
                            .ToLowerInvariant())
                        .Replace("{userId}", userId.ToString())
                        .Replace("{width}", width <= 0 ? "50" : width.ToString())
                        .Replace("{height}", height <= 0 ? "" : height.ToString())
                        .Replace("{userItemPermissions}", ((int)userItemPermissions).ToString())
                        .Replace("{fieldMode}", fieldMode)
                        .Replace("{linkType}", linkType.ToString())
                        .Replace("{entityType}", entityType)
                        .Replace("{default_value}", $"'{HttpUtility.JavaScriptStringEncode(defaultValue)}'")
                        .Replace("{subDomain}", subDomain)
                        .Replace("{baseUrl}", requestBaseUrl);
                }

                // Add the final templates to the current group.
                group.HtmlTemplateBuilder.Append(htmlTemplate ?? "");
                group.ScriptTemplateBuilder.Append(scriptTemplate ?? "");
            }

            // Combine all groups into each tab.
            foreach (var tab in results.Tabs)
            {
                if (tab.Groups.Count <= 1)
                {
                    tab.HtmlTemplateBuilder = tab.Groups.Single().HtmlTemplateBuilder;
                    tab.ScriptTemplateBuilder = tab.Groups.Single().ScriptTemplateBuilder;
                }
                else
                {
                    foreach (var group in tab.Groups)
                    {
                        if (String.IsNullOrEmpty(group.Name))
                        {
                            tab.HtmlTemplateBuilder.Append($"<div class=\"item-group\">");
                        }
                        else
                        {
                            tab.HtmlTemplateBuilder.Append($"<div class=\"item-group\"><h3>{group.Name.HtmlEncode()}</h3>");
                        }

                        tab.HtmlTemplateBuilder.Append(group.HtmlTemplateBuilder);
                        tab.HtmlTemplateBuilder.Append("</div>");
                        tab.ScriptTemplateBuilder.Append(group.ScriptTemplateBuilder);
                    }
                }
            }

            return new ServiceResult<ItemHtmlAndScriptModel>(results);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<WiserItemModel>> GetItemDetailsAsync(string encryptedId, ClaimsIdentity identity, string entityType = null)
        {
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var itemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);
            var (success, _, _) = await wiserItemsService.CheckIfEntityActionIsPossibleAsync(itemId, EntityActions.Read, userId, onlyCheckAccessRights: true, entityType: entityType);

            // If the user is not allowed to read this item, return an empty result.
            if (!success)
            {
                return new ServiceResult<WiserItemModel>();
            }

            var result = await wiserItemsService.GetItemDetailsAsync(itemId, entityType: entityType, skipPermissionsCheck: true);
            if (result != null)
            {
                result.EncryptedId = await wiserTenantsService.EncryptValue(result.Id, identity);
            }

            return new ServiceResult<WiserItemModel>(result);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<List<WiserItemModel>>> GetLinkedItemDetailsAsync(string encryptedId, ClaimsIdentity identity, string entityType = null, string itemIdEntityType = null, int linkType = 0, bool reversed = false)
        {
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var itemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);

            // First check if the user is allowed to access the main item.
            var (success, _, _) = await wiserItemsService.CheckIfEntityActionIsPossibleAsync(itemId, EntityActions.Read, userId, onlyCheckAccessRights: true, entityType: entityType);

            // If the user is not allowed to read this item, return an empty result.
            if (!success)
            {
                return new ServiceResult<List<WiserItemModel>>();
            }

            // Now try to retrieve a linked item.
            var result = await wiserItemsService.GetLinkedItemDetailsAsync(itemId, linkType, entityType, false, userId, reversed, itemIdEntityType);
            if (result == null) return new ServiceResult<List<WiserItemModel>>();

            foreach (var item in result)
            {
                item.EncryptedId = await wiserTenantsService.EncryptValue(item.Id, identity);
            }

            return new ServiceResult<List<WiserItemModel>>(result);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<ItemMetaDataModel>> GetItemMetaDataAsync(string encryptedId, ClaimsIdentity identity, string entityType = null)
        {
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var tablePrefix = await wiserItemsService.GetTablePrefixForEntityAsync(entityType);
            var itemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);
            var (success, _, userItemPermissions) = await wiserItemsService.CheckIfEntityActionIsPossibleAsync(itemId, EntityActions.Read, userId, onlyCheckAccessRights: true, entityType: entityType);

            // If the user is not allowed to read this item, return an empty result.
            if (!success)
            {
                return new ServiceResult<ItemMetaDataModel>();
            }

            var result = new ItemMetaDataModel
            {
                CanRead = (userItemPermissions & AccessRights.Read) == AccessRights.Read,
                CanCreate = (userItemPermissions & AccessRights.Create) == AccessRights.Create,
                CanWrite = (userItemPermissions & AccessRights.Update) == AccessRights.Update,
                CanDelete = (userItemPermissions & AccessRights.Delete) == AccessRights.Delete
            };

            clientDatabaseConnection.ClearParameters();
            clientDatabaseConnection.AddParameter("itemId", itemId);
            clientDatabaseConnection.AddParameter("userId", userId);

            var query = $@"SELECT
	                        item.id,
                            item.original_item_id,
                            item.unique_uuid,
                            item.entity_type,
                            item.published_environment,
                            IF(item.readonly > 0, 'Ja', 'Nee') AS readonly,
                            item.title AS title,
                            item.added_on,
                            IF(item.added_by IS NULL OR item.added_by = '', 'Onbekend', item.added_by) AS added_by,
                            item.changed_on,
                            item.changed_by,
                            permission.id AS permissionId,
                            permission.permissions,
                            IFNULL(entity.enable_multiple_environments, 0) AS enable_multiple_environments,
                            entity.delete_action AS `delete_action`
                        FROM {tablePrefix}{WiserTableNames.WiserItem}{{0}} AS item
                        LEFT JOIN {WiserTableNames.WiserEntity} AS entity ON entity.name = item.entity_type AND entity.module_id = item.moduleid

                        # Check permissions. Default permissions are everything enabled, so if the user has no role or the role has no permissions on this item, they are allowed everything.
                        LEFT JOIN {WiserTableNames.WiserUserRoles} AS user_role ON user_role.user_id = ?userId
                        LEFT JOIN {WiserTableNames.WiserPermission} AS permission ON permission.role_id = user_role.role_id AND permission.item_id = item.id

                        WHERE item.id = ?itemId
                        AND (permission.id IS NULL OR (permission.permissions & 1) > 0)
                        LIMIT 1";

            // First check the normal wiser_item table.
            var dataTable = await clientDatabaseConnection.GetAsync(String.Format(query, ""));

            if (dataTable.Rows.Count == 0)
            {
                // If the item was not found in the normal table, check the archive table.
                dataTable = await clientDatabaseConnection.GetAsync(String.Format(query, WiserTableNames.ArchiveSuffix));

                if (dataTable.Rows.Count == 0)
                {
                    // If the item isn't found in the archive either, return a 404.
                    return new ServiceResult<ItemMetaDataModel>
                    {
                        StatusCode = HttpStatusCode.NotFound
                    };
                }

                // If we get to this point, the item was found in the archive, which means it has been deleted.
                result.Removed = true;
            }

            result.Id = itemId;
            result.EncryptedId = encryptedId;
            result.OriginalItemId = await wiserTenantsService.EncryptValue(Convert.ToString(dataTable.Rows[0]["original_item_id"]), identity);
            result.EntityType = dataTable.Rows[0].Field<string>("entity_type");
            result.UniqueUuid = dataTable.Rows[0].Field<string>("unique_uuid");
            result.PublishedEnvironment = dataTable.Rows[0].Field<int>("published_environment");
            result.ReadOnly = dataTable.Rows[0].Field<string>("readonly");
            result.Title = dataTable.Rows[0].Field<string>("title");
            result.AddedOn = dataTable.Rows[0].Field<DateTime>("added_on");
            result.AddedBy = dataTable.Rows[0].Field<string>("added_by");
            result.ChangedOn = dataTable.Rows[0].Field<DateTime?>("changed_on");
            result.ChangedBy = dataTable.Rows[0].Field<string>("changed_by");
            result.EnableMultipleEnvironments = Convert.ToBoolean(dataTable.Rows[0]["enable_multiple_environments"]);
            result.DeleteAction = dataTable.Rows[0].Field<string>("delete_action");

            return new ServiceResult<ItemMetaDataModel>(result);
        }

        /// <inheritdoc />
        public async Task<(string Query, ServiceResult<T> ErrorResult, string RawOptions)> GetPropertyQueryAsync<T>(int propertyId, string queryColumnName, bool alsoGetOptions, ulong? itemId = null)
        {
            ServiceResult<T> errorResult;

            // Get the data query and properties of the grid.
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            clientDatabaseConnection.ClearParameters();
            clientDatabaseConnection.AddParameter("propertyId", propertyId);

            var query = $@"SELECT `{queryColumnName}`{(alsoGetOptions ? ", options" : "")} FROM {WiserTableNames.WiserEntityProperty} WHERE id = ?propertyId";
            var dataTable = await clientDatabaseConnection.GetAsync(query);
            if (dataTable.Rows.Count == 0)
            {
                errorResult = new ServiceResult<T>
                {
                    StatusCode = HttpStatusCode.NotFound,
                    ErrorMessage = $"Property with id '{propertyId}' not found."
                };

                return (null, errorResult, null);
            }

            var result = dataTable.Rows[0].Field<string>(queryColumnName);
            var options = alsoGetOptions ? dataTable.Rows[0].Field<string>("options") : null;
            if (!String.IsNullOrWhiteSpace(result))
            {
                if (itemId.HasValue)
                {
                    result = result.Replace("{itemId}", itemId.Value.ToString(), StringComparison.OrdinalIgnoreCase);
                }

                return (result, null, options);
            }

            errorResult = new ServiceResult<T>
            {
                StatusCode = HttpStatusCode.NotFound,
                ErrorMessage = $"No query found for the grid with property id '{propertyId}'."
            };

            return (null, errorResult, options);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<string>> GetEncryptedIdAsync(ulong itemId, ClaimsIdentity identity)
        {
            try
            {
                clientDatabaseConnection.ClearParameters();

                string permissionQuery = @"
                    SELECT
	                    LEAST(COUNT(*), 1) AS has_permission
                    FROM wiser_module module
                    JOIN wiser_permission permission ON permission.`module_id` = module.`id`
                    JOIN wiser_user_roles user_role ON user_role.`role_id` = permission.`role_id`
                    WHERE
	                    module.type = 'Search' AND
	                    user_role.user_id = @userId;";
                
                clientDatabaseConnection.AddParameter("userId", IdentityHelpers.GetWiserUserId(identity));

                DbDataReader reader = await clientDatabaseConnection.GetReaderAsync(permissionQuery);
                bool hasPermission = await reader.ReadAsync() && reader.GetBoolean(0);

                if (!hasPermission)
                    return new ServiceResult<string>
                    {
                        StatusCode = HttpStatusCode.Forbidden,
                        ErrorMessage = "Insufficient permissions"
                    };
            }
            catch (Exception exception)
            {
                return new ServiceResult<string>
                {
                    StatusCode = HttpStatusCode.BadRequest,
                    ErrorMessage = $"{exception.Message}:\n{exception.InnerException}"
                };
            }
            finally
            {
                clientDatabaseConnection.ClearParameters();
            }

            var tenant = await wiserTenantsService.GetSingleAsync(identity);
            var encryptionKey = tenant.ModelObject.EncryptionKey;
            return new ServiceResult<string>(itemId.ToString().EncryptWithAesWithSalt(encryptionKey, true));
        }

        /// <inheritdoc />
        public async Task<ServiceResult<string>> GetHtmlForWiserEntityAsync(ulong itemId, ClaimsIdentity identity, string entityType = null)
        {
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var (template, dataRow) = await wiserItemsService.GetTemplateAndDataForItemAsync(itemId, entityType);
            var result = await stringReplacementsService.DoAllReplacementsAsync(template, dataRow, removeUnknownVariables: false);
            return new ServiceResult<string>(result);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<List<EntityTypeModel>>> GetPossibleEntityTypesAsync(ulong itemId, ClaimsIdentity identity)
        {
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            clientDatabaseConnection.ClearParameters();
            clientDatabaseConnection.AddParameter("itemId", itemId);

            var query = $@"SELECT IFNULL(friendly_name, name) AS name, name AS value, dedicated_table_prefix
FROM {WiserTableNames.WiserEntity}
ORDER BY IFNULL(friendly_name, name) ASC";
            var dataTable = await clientDatabaseConnection.GetAsync(query);

            var results = new List<EntityTypeModel>();
            if (dataTable.Rows.Count == 0)
            {
                return new ServiceResult<List<EntityTypeModel>>(results);
            }

            // Look in all wiser_item tables of an item exists with the given ID.
            var groups = dataTable.Rows.Cast<DataRow>().Select(dataRow => new Tuple<string, string, string>(dataRow.Field<string>("value"), dataRow.Field<string>("name"), dataRow.Field<string>("dedicated_table_prefix"))).ToList().GroupBy(x => x.Item3);
            foreach (var group in groups)
            {
                var tablePrefix = group.Key;
                var tableName = $"{tablePrefix}{(!String.IsNullOrWhiteSpace(tablePrefix) && !tablePrefix.EndsWith("_") ? "_" : "")}{WiserTableNames.WiserItem}";
                if (!await databaseHelpersService.TableExistsAsync(tableName))
                {
                    continue;
                }

                query = $@"SELECT entity_type FROM {tableName} WHERE id = ?itemId
UNION
SELECT entity_type FROM {tableName}_archive WHERE id = ?itemId";
                dataTable = await clientDatabaseConnection.GetAsync(query);
                if (dataTable.Rows.Count == 0)
                {
                    continue;
                }

                var itemEntityType = dataTable.Rows[0].Field<string>("entity_type");
                var entity = group.FirstOrDefault(x => String.Equals(itemEntityType, x.Item1, StringComparison.OrdinalIgnoreCase));

                if (entity == null)
                {
                    continue;
                }

                results.Add(new EntityTypeModel
                {
                    Id = entity.Item1,
                    DisplayName = entity.Item2,
                    DedicatedTablePrefix = tablePrefix
                });
            }

            return new ServiceResult<List<EntityTypeModel>>(results);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<bool>> FixTreeViewOrderingAsync(int moduleId, ClaimsIdentity identity, string encryptedParentId = null, int linkType = 1)
        {
            var tenant = (await wiserTenantsService.GetSingleAsync(identity)).ModelObject;
            var parentId = String.IsNullOrWhiteSpace(encryptedParentId) ? 0 : wiserTenantsService.DecryptValue<ulong>(encryptedParentId, tenant);
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            clientDatabaseConnection.ClearParameters();
            clientDatabaseConnection.AddParameter("moduleId", moduleId);
            clientDatabaseConnection.AddParameter("parentId", parentId);
            clientDatabaseConnection.AddParameter("linkType", linkType);

            var moduleIdClause = moduleId <= 0 ? "" : "AND item.moduleid = ?moduleId";

            // Fix the ordering of items, because when people import items, they often don't set the order number correctly.
            // So we do that first here, to make sure they're all set correctly, otherwise moving items to a different position in the tree view won't work properly.
            var query = $@"SET @orderingNumber = 0;
                        UPDATE {WiserTableNames.WiserItemLink} AS link
                        JOIN (
                            SELECT
    	                        x.id,
    	                        (@orderingNumber := @orderingNumber + 1) AS ordering
                            FROM (
                                SELECT
                                    link.id
                                FROM {WiserTableNames.WiserItemLink} AS link
                                JOIN {WiserTableNames.WiserItem} AS item ON item.id = link.item_id {moduleIdClause}
                                WHERE link.destination_item_id = ?parentId
                                AND link.type = ?linkType
		                        GROUP BY IF(item.original_item_id > 0, item.original_item_id, item.id)
                                ORDER BY link.ordering ASC
                            ) AS x
                        ) AS ordering ON ordering.id = link.id
                        JOIN {WiserTableNames.WiserItem} AS item ON item.id = link.item_id {moduleIdClause}
                        SET link.ordering = ordering.ordering
                        WHERE link.destination_item_id = ?parentId
                        AND link.type = ?linkType";
            await clientDatabaseConnection.ExecuteAsync(query);

            // Items that are copies of another item, should get the same ordering as the original.
            query = $@"UPDATE {WiserTableNames.WiserItemLink} AS link
                    JOIN {WiserTableNames.WiserItem} AS item ON item.id = link.item_id AND item.original_item_id > 0 AND item.original_item_id <> item.id
                    JOIN {WiserTableNames.WiserItemLink} AS link2 ON link2.destination_item_id = ?parentId AND link2.item_id = item.original_item_id
                    SET link.ordering = link2.ordering
                    WHERE link.destination_item_id = ?parentId
                    AND link.type = ?linkType";
            await clientDatabaseConnection.ExecuteAsync(query);

            if (parentId <= 0)
            {
                return new ServiceResult<bool>(true);
            }

            // Fix ordering for wiser_item.
            query = $@"SET @orderingNumber = 0;
                    UPDATE {WiserTableNames.WiserItem} AS item
                    JOIN (
                        SELECT
    	                    x.id,
    	                    (@orderingNumber := @orderingNumber + 1) AS ordering
                        FROM (
                            SELECT
                                item.id
                            FROM {WiserTableNames.WiserItem} AS item
                            WHERE item.parent_item_id = ?parentId
                            {moduleIdClause}
		                    GROUP BY IF(item.original_item_id > 0, item.original_item_id, item.id)
                            ORDER BY item.ordering ASC
                        ) AS x
                    ) AS ordering ON ordering.id = item.id
                    SET item.ordering = ordering.ordering
                    WHERE item.parent_item_id = ?parentId
                    {moduleIdClause}";
            await clientDatabaseConnection.ExecuteAsync(query);

            query = $@"UPDATE {WiserTableNames.WiserItem} AS item 
                    JOIN {WiserTableNames.WiserItem} AS item2 ON item2.parent_item_id = ?parentId AND item2.id = item.original_item_id
                    SET item.ordering = item2.ordering
                    WHERE item.parent_item_id = ?parentId
                    AND item.original_item_id > 0 
                    AND item.original_item_id <> item.id";
            await clientDatabaseConnection.ExecuteAsync(query);

            return new ServiceResult<bool>(true);
        }

        /// <inheritdoc />
        public async Task<ServiceResult<List<TreeViewItemModel>>> GetItemsForTreeViewAsync(int moduleId, ClaimsIdentity identity, string parentEntityType = null, string encryptedParentId = null, string orderBy = null, string encryptedCheckId = null, int linkType = 0, string childEntityTypes = null)
        {
            if (moduleId <= 0)
            {
                return new ServiceResult<List<TreeViewItemModel>>
                {
                    StatusCode = HttpStatusCode.BadRequest,
                    ErrorMessage = "Invalid module ID"
                };
            }

            await FixTreeViewOrderingAsync(moduleId, identity, encryptedParentId);

            var tenant = (await wiserTenantsService.GetSingleAsync(identity)).ModelObject;
            var parentId = String.IsNullOrWhiteSpace(encryptedParentId) ? 0 : wiserTenantsService.DecryptValue<ulong>(encryptedParentId, tenant);
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var results = new List<TreeViewItemModel>();
            var checkId = String.IsNullOrWhiteSpace(encryptedCheckId) ? 0 : wiserTenantsService.DecryptValue<ulong>(encryptedCheckId, tenant);
            
            var parentEntitySettings = await wiserItemsService.GetEntityTypeSettingsAsync(parentEntityType ?? String.Empty, moduleId);
            var parentTablePrefix = wiserItemsService.GetTablePrefixForEntity(parentEntitySettings);
            
            var firstChild = parentEntitySettings.AcceptedChildTypes.FirstOrDefault();
            if (firstChild is null)
            {
                return new ServiceResult<List<TreeViewItemModel>>();
            }

            var childEntitySettings = await wiserItemsService.GetEntityTypeSettingsAsync(firstChild, moduleId);
            var tablePrefix = wiserItemsService.GetTablePrefixForEntity(childEntitySettings);
            
            var allLinkTypeSettings = await wiserItemsService.GetAllLinkTypeSettingsAsync();
            var linkTypesToHideFromTreeView = allLinkTypeSettings.Where(x => !x.ShowInTreeView).Select(x => x.Type).ToList();
            if (!linkTypesToHideFromTreeView.Any())
            {
                // Just to make it easier in the queries below.
                linkTypesToHideFromTreeView.Add(-1);
            }

            var linkTypesToHideFromTreeViewList = String.Join(",", linkTypesToHideFromTreeView);
            
            // Figure out which items have children, so the tree view knows where to show arrows for expanding items.
            // We used to do this in the original queries above, but with the new option of linking items via parent_item_id from wiser_item, instead of via wiser_itemlink,
            // this got a lot more complicated and the original queries got too slow when adding all that to them.
            // So now we have a separate query just to check which items have children.
            
            var firstSubChild = childEntitySettings.AcceptedChildTypes.FirstOrDefault();

            if (firstSubChild is null)
            {
                return new ServiceResult<List<TreeViewItemModel>>(results);
            }

            var childPrefix = await wiserItemsService.GetTablePrefixForEntityAsync(firstSubChild);
            
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            clientDatabaseConnection.ClearParameters();
            clientDatabaseConnection.AddParameter("moduleId", moduleId);
            clientDatabaseConnection.AddParameter("userId", userId);
            clientDatabaseConnection.AddParameter("parentId", parentId);
            clientDatabaseConnection.AddParameter("childEntityTypes", childEntityTypes ?? "");
            clientDatabaseConnection.AddParameter("checkId", checkId);

            var orderByClause = "IF(item.title IS NULL OR item.title = '', item.id, item.title) ASC";
            if (String.IsNullOrWhiteSpace(orderBy))
            {
                orderByClause = $"IF(IFNULL(entityModule.default_ordering, entity.default_ordering) = 'link_ordering', link_parent.ordering, TRUE) ASC, {orderByClause}";
            }
            else if (String.Equals(orderBy, "item_title", StringComparison.OrdinalIgnoreCase))
            {
                orderByClause = $"link_parent.ordering ASC, {orderByClause}";
            }

            var checkIdJoin = "";
            if (checkId > 0)
            {
                checkIdJoin = $@"# Check if item needs to be checked in item-linker field.
LEFT JOIN {WiserTableNames.WiserItemLink} AS checked ON checked.item_id = item.id AND checked.destination_item_id = ?checkId";
                if (linkType > 0)
                {
                    clientDatabaseConnection.AddParameter("linkType", linkType);
                    checkIdJoin += " AND checked.type = ?linkType";
                }
            }

            // Get items via wiser_itemlink.
            var query = $@"SELECT
	item.id,
	item.original_item_id,
	IF(item.title IS NULL OR item.title = '', item.id, item.title) AS name,
	IFNULL(entityModule.icon, entity.icon) AS icon,
	IFNULL(entityModule.icon_expanded, entity.icon_expanded) AS icon_expanded,
	IF(MAX(item.published_environment) = 0, 'hiddenOnWebsite', '') AS nodeCssClass,
	item.entity_type,
	GROUP_CONCAT(DISTINCT IFNULL(entityModule.accepted_childtypes, entity.accepted_childtypes)) AS accepted_childtypes,
    {(checkId > 0 ? "IF(checked.id IS NULL, 0, 1)" : "0")} AS checked

# Get the items linked to the parent.
FROM {tablePrefix}{WiserTableNames.WiserItem} AS item
JOIN {WiserTableNames.WiserEntity} AS entity ON entity.name = item.entity_type AND entity.show_in_tree_view = 1
LEFT JOIN {WiserTableNames.WiserEntity} AS entityModule ON entityModule.name = item.entity_type AND entityModule.show_in_tree_view = 1 AND entityModule.module_id = item.moduleid
JOIN {WiserTableNames.WiserItemLink} AS link_parent ON link_parent.item_id = item.id AND link_parent.destination_item_id = ?parentId AND link_parent.type NOT IN ({linkTypesToHideFromTreeViewList})

# Check permissions. Default permissions are everything enabled, so if the user has no role or the role has no permissions on this item, they are allowed everything.
LEFT JOIN {WiserTableNames.WiserUserRoles} AS user_role ON user_role.user_id = ?userId
LEFT JOIN {WiserTableNames.WiserPermission} AS permission ON permission.role_id = user_role.role_id AND permission.item_id = item.id

# Only get items that should actually be shown, based on accepted_childtypes from wiser_entity.
LEFT JOIN {parentTablePrefix}{WiserTableNames.WiserItem} parent_item ON parent_item.id = link_parent.destination_item_id
JOIN {WiserTableNames.WiserEntity} AS parent_entity ON ((link_parent.destination_item_id = 0 AND parent_entity.`name` = '') OR parent_entity.`name` = parent_item.entity_type) AND (parent_entity.accepted_childtypes = '' OR FIND_IN_SET(item.entity_type, parent_entity.accepted_childtypes))

{checkIdJoin}

WHERE TRUE
AND item.moduleid = ?moduleId
AND (permission.id IS NULL OR (permission.permissions & 1) > 0)
GROUP BY IF(item.original_item_id > 0, item.original_item_id, item.id)

ORDER BY {orderByClause}";
            var dataTable = await clientDatabaseConnection.GetAsync(query);

            if (dataTable.Rows.Count > 0)
            {
                foreach (DataRow dataRow in dataTable.Rows)
                {
                    AddItem(dataRow);
                }
            }

            // If there are no entities that use item_parent_id from wiser_item with the given parent, just return the results.
            if (parentId > 0)
            {
                query = $@"SELECT COUNT(*) AS total
                        FROM {parentTablePrefix}{WiserTableNames.WiserItem} AS item
                        JOIN {WiserTableNames.WiserLink} AS link ON link.destination_entity_type = item.entity_type AND link.use_item_parent_id = 1
                        WHERE item.id = ?parentId";
            }
            else
            {
                query = $@"SELECT COUNT(*) AS total
                        FROM {WiserTableNames.WiserLink} AS link
                        WHERE link.destination_entity_type = ''
                        AND link.use_item_parent_id = 1";
            }

            dataTable = await clientDatabaseConnection.GetAsync(query);

            if (Convert.ToInt32(dataTable.Rows[0]["total"]) > 0)
            {
                orderByClause = "IF(item.title IS NULL OR item.title = '', item.id, item.title) ASC";
                if (String.IsNullOrWhiteSpace(orderBy))
                {
                    orderByClause = $"IF(IFNULL(entityModule.default_ordering, entity.default_ordering) = 'link_ordering', item.ordering, TRUE) ASC, {orderByClause}";
                }
                else if (String.Equals(orderBy, "item_title", StringComparison.OrdinalIgnoreCase))
                {
                    orderByClause = $"item.ordering ASC, {orderByClause}";
                }

                // Get children via the column parent_item_id of the table wiser_item.
                query = $@"SELECT 
	item.id,
	item.original_item_id,
	IF(item.title IS NULL OR item.title = '', item.id, item.title) AS name,
	IFNULL(entityModule.icon, entity.icon) AS icon,
	IFNULL(entityModule.icon_expanded, entity.icon_expanded) AS icon_expanded,
	IF(MAX(item.published_environment) = 0, 'hiddenOnWebsite', '') AS nodeCssClass,
	item.entity_type,
	GROUP_CONCAT(DISTINCT IFNULL(entityModule.accepted_childtypes, entity.accepted_childtypes)) AS accepted_childtypes,
    IF(item.parent_item_id > 0 AND item.parent_item_id = ?checkId, 1, 0) AS checked

# Get the items linked to the parent.
FROM {tablePrefix}{WiserTableNames.WiserItem} AS item
JOIN {WiserTableNames.WiserEntity} AS entity ON entity.name = item.entity_type AND entity.show_in_tree_view = 1
LEFT JOIN {WiserTableNames.WiserEntity} AS entityModule ON entityModule.name = item.entity_type AND entityModule.show_in_tree_view = 1 AND entityModule.module_id = item.moduleid

# Check permissions. Default permissions are everything enabled, so if the user has no role or the role has no permissions on this item, they are allowed everything.
LEFT JOIN {WiserTableNames.WiserUserRoles} AS user_role ON user_role.user_id = ?userId
LEFT JOIN {WiserTableNames.WiserPermission} AS permission ON permission.role_id = user_role.role_id AND permission.item_id = item.id

# Only get items that should actually be shown, based on accepted_childtypes from wiser_entity.
LEFT JOIN {parentTablePrefix}{WiserTableNames.WiserItem} parent_item ON parent_item.id = item.parent_item_id
JOIN {WiserTableNames.WiserEntity} AS parent_entity ON {(parentId == 0 ? "parent_entity.module_id = ?moduleId AND parent_entity.`name` = ''" : "parent_entity.`name` = parent_item.entity_type")} AND (parent_entity.accepted_childtypes = '' OR FIND_IN_SET(item.entity_type, parent_entity.accepted_childtypes))

# Link settings to check if these links should be shown.
LEFT JOIN {WiserTableNames.WiserLink} AS link_settings ON link_settings.destination_entity_type = parent_item.entity_type AND link_settings.connected_entity_type = item.entity_type

WHERE item.parent_item_id = ?parentId
AND (?childEntityTypes = '' OR FIND_IN_SET(item.entity_type, ?childEntityTypes))
AND item.moduleid = ?moduleId
AND (permission.id IS NULL OR (permission.permissions & 1) > 0)
AND IFNULL(link_settings.show_in_tree_view, 1) = 1
GROUP BY IF(item.original_item_id > 0, item.original_item_id, item.id)

ORDER BY {orderByClause}";
                dataTable = await clientDatabaseConnection.GetAsync(query);

                if (dataTable.Rows.Count > 0)
                {
                    foreach (DataRow dataRow in dataTable.Rows)
                    {
                        AddItem(dataRow);
                    }
                }
            }

            // Skip the rest of the function if we have no results.
            if (!results.Any())
            {
                return new ServiceResult<List<TreeViewItemModel>>(results);
            }
            
            query = $@"SELECT 
	                    item.id,
	                    item.original_item_id,
	                    IF(COUNT(child.id) > 0 AND COUNT(child_entity.id) > 0 AND SUM(IF(child_entity.id IS NOT NULL, 1, 0)) > 0, 1, 0) AS has_children

                    # Get the items linked to the parent.
                    FROM {tablePrefix}{WiserTableNames.WiserItem} AS item
                    JOIN {WiserTableNames.WiserEntity} AS entity ON entity.name = item.entity_type AND entity.show_in_tree_view = 1

                    JOIN {WiserTableNames.WiserItemLink} link_child ON link_child.destination_item_id = item.id AND link_child.type NOT IN ({linkTypesToHideFromTreeViewList})
                    JOIN {childPrefix}{WiserTableNames.WiserItem} AS child ON child.id = link_child.item_id AND child.moduleid = ?moduleId AND (?childEntityTypes = '' OR FIND_IN_SET(child.entity_type, ?childEntityTypes))
                    JOIN {WiserTableNames.WiserEntity} AS child_entity ON child_entity.name = child.entity_type AND child_entity.show_in_tree_view = 1 AND (entity.accepted_childtypes = '' OR FIND_IN_SET(child.entity_type, entity.accepted_childtypes))

                    # Check permissions. Default permissions are everything enabled, so if the user has no role or the role has no permissions on this item, they are allowed everything.
                    LEFT JOIN {WiserTableNames.WiserUserRoles} AS user_role ON user_role.user_id = ?userId
                    LEFT JOIN {WiserTableNames.WiserPermission} AS permission ON permission.role_id = user_role.role_id AND permission.item_id = child.id

                    WHERE item.id IN ({String.Join(",", results.Select(i => i.PlainItemId))})
                    AND item.moduleid = ?moduleId
                    AND (permission.id IS NULL OR (permission.permissions & 1) > 0)
                    GROUP BY IF(item.original_item_id > 0, item.original_item_id, item.id)

                    UNION

                    SELECT 
	                    item.id,
	                    item.original_item_id,
	                    IF(COUNT(child.id) > 0 AND COUNT(child_entity.id) > 0 AND SUM(IF(child_entity.id IS NOT NULL AND child_link_settings.show_in_tree_view IS NULL, 1, IFNULL(child_link_settings.show_in_tree_view, 0))) > 0, 1, 0) AS has_children

                    # Get the items linked to the parent.
                    FROM {tablePrefix}{WiserTableNames.WiserItem} AS item
                    JOIN {WiserTableNames.WiserEntity} AS entity ON entity.name = item.entity_type AND entity.show_in_tree_view = 1

                    # Note: The entity_type <> '' is to force the use of the correct index, otherwise the query will be a lot slower.
                    JOIN {childPrefix}{WiserTableNames.WiserItem} AS child ON child.parent_item_id = item.id AND child.entity_type <> '' AND child.moduleid = ?moduleId AND (?childEntityTypes = '' OR FIND_IN_SET(child.entity_type, ?childEntityTypes))
                    JOIN {WiserTableNames.WiserEntity} AS child_entity ON child_entity.name = child.entity_type AND child_entity.show_in_tree_view = 1 AND (entity.accepted_childtypes = '' OR FIND_IN_SET(child.entity_type, entity.accepted_childtypes))
                    # Link settings to check if these links should be shown.
                    LEFT JOIN {WiserTableNames.WiserLink} AS child_link_settings ON child_link_settings.destination_entity_type = item.entity_type AND child_link_settings.connected_entity_type = child.entity_type

                    # Check permissions. Default permissions are everything enabled, so if the user has no role or the role has no permissions on this item, they are allowed everything.
                    LEFT JOIN {WiserTableNames.WiserUserRoles} AS user_role ON user_role.user_id = ?userId
                    LEFT JOIN {WiserTableNames.WiserPermission} AS permission ON permission.role_id = user_role.role_id AND permission.item_id = child.id

                    WHERE item.id IN ({String.Join(",", results.Select(i => i.PlainItemId))})
                    AND item.moduleid = ?moduleId
                    AND (permission.id IS NULL OR (permission.permissions & 1) > 0)
                    GROUP BY IF(item.original_item_id > 0, item.original_item_id, item.id)";
            dataTable = await clientDatabaseConnection.GetAsync(query);

            if (dataTable.Rows.Count == 0)
            {
                return new ServiceResult<List<TreeViewItemModel>>(results);
            }

            // Find all items that have children and set the "HasChildren" property to true for those items.
            foreach (DataRow dataRow in dataTable.Rows)
            {
                var itemId = dataRow.Field<ulong>("id");
                var originalItemId = dataRow.Field<ulong>("original_item_id");
                var hasChildren = Convert.ToBoolean(dataRow["has_children"]);
                if (!hasChildren)
                {
                    continue;
                }

                var item = results.FirstOrDefault(i => i.PlainItemId == itemId) ?? (originalItemId > 0 ? results.FirstOrDefault(i => i.OriginalParentId == originalItemId) : null);
                if (item == null)
                {
                    continue;
                }

                item.HasChildren = true;
            }

            return new ServiceResult<List<TreeViewItemModel>>(results);
            
            // Inline function to convert a DataRow to a TreeViewItemModel and add it to the results list.
            void AddItem(DataRow dataRow)
            {
                var itemId = dataRow.Field<ulong>("id");
                var originalItemId = dataRow.Field<ulong>("original_item_id");

                if (results.Any(item => item.PlainItemId == itemId))
                {
                    return;
                }

                results.Add(new TreeViewItemModel
                {
                    EntityType = dataRow.Field<string>("entity_type"),
                    Title = dataRow.Field<string>("name"),
                    AcceptedChildTypes = dataRow.Field<string>("accepted_childtypes"),
                    CollapsedSpriteCssClass = dataRow.Field<string>("icon"),
                    EncryptedItemId = wiserTenantsService.EncryptValue(itemId, tenant),
                    EncryptedOriginalItemId = wiserTenantsService.EncryptValue(originalItemId, tenant),
                    ExpandedSpriteCssClass = dataRow.Field<string>("icon_expanded"),
                    NodeCssClass = dataRow.Field<string>("nodeCssClass"),
                    PlainItemId = itemId,
                    PlainOriginalItemId = originalItemId,
                    OriginalParentId = parentId,
                    DestinationItemId = wiserTenantsService.EncryptValue(parentId, tenant),
                    Checked = Convert.ToInt32(dataRow["checked"]) > 0
                });
            }
        }

        /// <inheritdoc />
        public async Task<ServiceResult<bool>> MoveItemAsync(ClaimsIdentity identity, string encryptedSourceId, string encryptedDestinationId, string position, string encryptedSourceParentId, string encryptedDestinationParentId, string sourceEntityType, string destinationEntityType, int moduleId)
        {
            if (String.IsNullOrWhiteSpace(encryptedSourceId)
                || String.IsNullOrWhiteSpace(encryptedDestinationId)
                || String.IsNullOrWhiteSpace(position)
                || String.IsNullOrWhiteSpace(encryptedSourceParentId)
                || String.IsNullOrWhiteSpace(encryptedDestinationParentId)
                || String.IsNullOrWhiteSpace(sourceEntityType)
                || String.IsNullOrWhiteSpace(destinationEntityType))
            {
                return new ServiceResult<bool>
                {
                    StatusCode = HttpStatusCode.BadRequest,
                    ErrorMessage = "The parameters encryptedSourceId, encryptedDestinationId, position, encryptedSourceParentId, encryptedDestinationParentId, sourceEntityType and destinationEntityType need to have a value"
                };
            }

            var tenant = (await wiserTenantsService.GetSingleAsync(identity)).ModelObject;
            var sourceId = wiserTenantsService.DecryptValue<ulong>(encryptedSourceId, tenant);
            var destinationId = wiserTenantsService.DecryptValue<ulong>(encryptedDestinationId, tenant);
            var sourceParentId = wiserTenantsService.DecryptValue<ulong>(encryptedSourceParentId, tenant);
            var destinationParentId = wiserTenantsService.DecryptValue<ulong>(encryptedDestinationParentId, tenant);
            var userId = IdentityHelpers.GetWiserUserId(identity);

            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var (success, errorMessage, _) = await wiserItemsService.CheckIfEntityActionIsPossibleAsync(sourceId, EntityActions.Update, userId, entityType: sourceEntityType);
            if (!success)
            {
                return new ServiceResult<bool>
                {
                    ErrorMessage = errorMessage,
                    StatusCode = HttpStatusCode.Forbidden
                };
            }

            try
            {
                await clientDatabaseConnection.BeginTransactionAsync();

                string query;
                DataTable dataTable;
               
                // If the position is "over", it means the destinationId itself will become the new parent, for "before" and "after" it means the destinationParentId will become the new parent.
                var positionIsOver = String.Equals(position, "over", StringComparison.OrdinalIgnoreCase);
                if (!positionIsOver)
                {
                    // If the destinationParentId becomes the new parent, we need to find out the correct entity type.
                    clientDatabaseConnection.ClearParameters();
                    clientDatabaseConnection.AddParameter("destinationParentId", destinationParentId);
                    query = $"SELECT entity_type FROM {WiserTableNames.WiserItem} WHERE id = ?destinationParentId";
                    dataTable = await clientDatabaseConnection.GetAsync(query);
                    if (dataTable.Rows.Count > 0)
                    {
                        destinationEntityType = dataTable.Rows[0].Field<string>("entity_type");
                    }
                }

                var destinationEntitySettings = await wiserItemsService.GetEntityTypeSettingsAsync(destinationEntityType, moduleId);
                if (!destinationEntitySettings.AcceptedChildTypes.Any(t => String.Equals(t, sourceEntityType, StringComparison.OrdinalIgnoreCase)))
                {
                    return new ServiceResult<bool>
                    {
                        ErrorMessage = $"Items van type '{sourceEntityType}' mogen niet toegevoegd worden onder items van type '{destinationEntityType}'.",
                        StatusCode = HttpStatusCode.BadRequest
                    };
                }

                var linkTypeSettings = await wiserItemsService.GetLinkTypeSettingsAsync(sourceEntityType: sourceEntityType, destinationEntityType: destinationEntityType);
                clientDatabaseConnection.ClearParameters();
                clientDatabaseConnection.AddParameter("userId", userId);
                clientDatabaseConnection.AddParameter("sourceId", sourceId);
                clientDatabaseConnection.AddParameter("destinationId", destinationId);
                clientDatabaseConnection.AddParameter("sourceParentId", sourceParentId);
                clientDatabaseConnection.AddParameter("destinationParentId", destinationParentId);
                clientDatabaseConnection.AddParameter("position", position);
                clientDatabaseConnection.AddParameter("sourceEntityType", sourceEntityType);
                clientDatabaseConnection.AddParameter("linkType", linkTypeSettings.Type);
                clientDatabaseConnection.AddParameter("destinationEntityType", destinationEntityType);

                // Get the old ordering number, well need this later.
                var oldOrderNumber = 0;
                query = linkTypeSettings.UseItemParentId
                    ? $"SELECT ordering FROM {WiserTableNames.WiserItem} WHERE id = ?sourceId"
                    : $"SELECT ordering FROM {WiserTableNames.WiserItemLink} WHERE item_id = ?sourceId AND destination_item_id = ?sourceParentId LIMIT 1";

                dataTable = await clientDatabaseConnection.GetAsync(query);
                if (dataTable.Rows.Count > 0 && !dataTable.Rows[0].IsNull("ordering"))
                {
                    oldOrderNumber = Convert.ToInt32(dataTable.Rows[0]["ordering"]);
                }

                clientDatabaseConnection.AddParameter("oldOrderNumber", oldOrderNumber);

                // Get new order number for if we're moving the item to a new directory.
                var newOrderNumber = 1;
                var destinationVariable = (positionIsOver ? "?destinationId" : "?destinationParentId");
                query = linkTypeSettings.UseItemParentId
                    ? $"SELECT MAX(ordering) AS newOrdering FROM {WiserTableNames.WiserItem} WHERE {(positionIsOver ? "" : "id = ?destinationId AND")} parent_item_id = {destinationVariable}"
                    : $"SELECT MAX(ordering) AS newOrdering FROM {WiserTableNames.WiserItemLink} WHERE {(positionIsOver ? "" : "item_id = ?destinationId AND")} destination_item_id = {destinationVariable}";

                dataTable = await clientDatabaseConnection.GetAsync(query);
                if (dataTable.Rows.Count > 0 && !dataTable.Rows[0].IsNull("newOrdering"))
                {
                    newOrderNumber = Convert.ToInt32(dataTable.Rows[0]["newOrdering"]);
                }

                // If we're moving the item after or over the destination, increase the order number by one.
                if (!String.Equals(position, "before", StringComparison.OrdinalIgnoreCase))
                {
                    newOrderNumber++;
                }

                clientDatabaseConnection.AddParameter("newOrderNumber", newOrderNumber);

                // Items voor of na de plaatsing (before/after) 1 plek naar achteren schuiven (niet bij plaatsen op een ander item, want dan komt het nieuwe item altijd achteraan)
                if (!positionIsOver)
                {
                    query = $@"UPDATE {WiserTableNames.WiserItemLink}
                            SET ordering = ordering + 1
                            WHERE destination_item_id = ?destinationParentId
                            AND ordering >= ?newOrderNumber
                            AND item_id <> ?sourceId";

                    if (linkTypeSettings.UseItemParentId)
                    {
                        query = $@"UPDATE {WiserTableNames.WiserItem}
                                SET ordering = ordering + 1
                                WHERE parent_item_id = ?destinationParentId
                                AND ordering >= ?newOrderNumber
                                AND id <> ?sourceId";
                    }

                    await clientDatabaseConnection.ExecuteAsync(query);
                }

                // Node plaatsen op nieuwe plek.
                query = $@"UPDATE {WiserTableNames.WiserItemLink} 
                        SET destination_item_id = IF(?position ='over', ?destinationId, ?destinationParentId), ordering = ?newOrderNumber
                        WHERE item_id = ?sourceId
                        AND destination_item_id = ?sourceParentId;

                        # Make sure all other versions of the item get the same ordering number.
                        UPDATE {WiserTableNames.WiserItem} AS item
                        JOIN {WiserTableNames.WiserItem} AS otherVersion ON otherVersion.original_item_id = item.original_item_id
                        JOIN {WiserTableNames.WiserItemLink} AS link ON link.item_id = otherVersion.id AND link.destination_item_id = ?sourceParentId
                        SET link.destination_item_id = IF(?position ='over', ?destinationId, ?destinationParentId), link.ordering = ?newOrderNumber
                        WHERE item.id = ?sourceId
                        AND item.original_item_id != 0";

                if (linkTypeSettings.UseItemParentId)
                {
                    query = $@"UPDATE {WiserTableNames.WiserItem}
                            SET parent_item_id = IF(?position ='over', ?destinationId, ?destinationParentId), ordering = ?newOrderNumber
                            WHERE id = ?sourceId
                            AND parent_item_id = ?sourceParentId;

                            # Make sure all other versions of the item get the same ordering number.
                            UPDATE {WiserTableNames.WiserItem} AS item
                            JOIN {WiserTableNames.WiserItem} AS otherVersion ON otherVersion.original_item_id = item.original_item_id
                            SET otherVersion.parent_item_id = IF(?position ='over', ?destinationId, ?destinationParentId), otherVersion.ordering = ?newOrderNumber
                            WHERE item.id = ?sourceId
                            AND item.original_item_id != 0
                            AND item.parent_item_id = ?sourceParentId";
                }

                await clientDatabaseConnection.ExecuteAsync(query);

                // In oude map gat opvullen (items opschuiven naar voren).
                query = $@"UPDATE {WiserTableNames.WiserItemLink}
                        SET ordering = ordering - 1
                        WHERE destination_item_id = ?sourceParentId
                        AND ordering > ?oldOrderNumber";

                if (linkTypeSettings.UseItemParentId)
                {
                    query = $@"UPDATE {WiserTableNames.WiserItem}
                            SET ordering = ordering - 1
                            WHERE parent_item_id = ?sourceParentId
                            AND ordering > ?oldOrderNumber";
                }

                await clientDatabaseConnection.ExecuteAsync(query);

                await clientDatabaseConnection.CommitTransactionAsync();
                return new ServiceResult<bool>
                {
                    StatusCode = HttpStatusCode.NoContent
                };
            }
            catch
            {
                await clientDatabaseConnection.RollbackTransactionAsync();
                throw;
            }
        }

        /// <inheritdoc />
        public async Task<ServiceResult<bool>> AddMultipleLinksAsync(ClaimsIdentity identity, List<string> encryptedSourceIds, List<string> encryptedDestinationIds, int linkType, string sourceEntityType = null, bool setOrdering = false)
        {
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var tenant  = (await wiserTenantsService.GetSingleAsync(identity)).ModelObject;
            var destinationIds = encryptedDestinationIds.Select(x => wiserTenantsService.DecryptValue<ulong>(x, tenant)).ToList();
            var sourceIds = encryptedSourceIds.Select(x => wiserTenantsService.DecryptValue<ulong>(x, tenant)).ToList();
            var linkTypeSettings = await wiserItemsService.GetLinkTypeSettingsAsync(linkType, sourceEntityType);
            var linkTablePrefix = wiserItemsService.GetTablePrefixForLink(linkTypeSettings);

            if (String.IsNullOrWhiteSpace(sourceEntityType))
            {
                sourceEntityType = linkTypeSettings.SourceEntityType;
            }

            var tablePrefix = String.IsNullOrWhiteSpace(sourceEntityType) ? "" : await wiserItemsService.GetTablePrefixForEntityAsync(sourceEntityType);
            var destinationTablePrefix = await wiserItemsService.GetTablePrefixForEntityAsync(linkTypeSettings.DestinationEntityType);

            clientDatabaseConnection.ClearParameters();
            clientDatabaseConnection.AddParameter("linkType", linkType);

            string query = "";
            if (linkTypeSettings.UseItemParentId)
            {
                if (destinationIds.Count != 1)
                {
                    return new ServiceResult<bool>
                    {
                        StatusCode = HttpStatusCode.BadRequest,
                        ErrorMessage = "Received more or less than 1 destination item ID for a link type that is set to use parent_item_id, this is not possible."
                    };
                }

                clientDatabaseConnection.AddParameter("parentId", destinationIds.First());
                query = $@"UPDATE {tablePrefix}{WiserTableNames.WiserItem} SET parent_item_id = ?parentId WHERE id IN ({String.Join(",", sourceIds)})";
            }
            else
            {
                if (setOrdering)
                {
                    foreach (var destinationId in destinationIds)
                    {
                        query = $@"{query}SET @ordering = 0;
                                INSERT IGNORE INTO {linkTablePrefix}{WiserTableNames.WiserItemLink} (item_id, destination_item_id, type, ordering)                                
                                SELECT source.id, destination.id, ?linkType, (@ordering:=IF(@ordering=0,IFNULL(MAX(link.ordering),0),0) + @ordering + 1)
                                FROM {tablePrefix}{WiserTableNames.WiserItem} AS source
                                JOIN {tablePrefix}{WiserTableNames.WiserItem} AS destination ON destination.id = {destinationId.ToString()}
                                LEFT JOIN {linkTablePrefix}{WiserTableNames.WiserItemLink} AS link ON link.destination_item_id = {destinationId.ToString()} AND link.type = ?linkType
                                WHERE source.id IN ({String.Join(",", sourceIds)})
                                GROUP BY source.id;";
                    }
                }
                else
                {
                    query = $@"INSERT IGNORE INTO {linkTablePrefix}{WiserTableNames.WiserItemLink} (item_id, destination_item_id, type)
                            SELECT source.id, destination.id, ?linkType
                            FROM {tablePrefix}{WiserTableNames.WiserItem} AS source
                            JOIN {destinationTablePrefix}{WiserTableNames.WiserItem} AS destination ON destination.id IN ({String.Join(",", destinationIds)})
                            WHERE source.id IN ({String.Join(",", sourceIds)})";    
                }
            }

            await clientDatabaseConnection.ExecuteAsync(query);

            return new ServiceResult<bool>
            {
                StatusCode = HttpStatusCode.NoContent
            };
        }

        /// <inheritdoc />
        public async Task<ServiceResult<bool>> RemoveMultipleLinksAsync(ClaimsIdentity identity, List<string> encryptedSourceIds, List<string> encryptedDestinationIds, int linkType, string sourceEntityType = null, bool setOrdering = false)
        {
            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var tenant = (await wiserTenantsService.GetSingleAsync(identity)).ModelObject;
            var destinationIds = encryptedDestinationIds.Select(x => wiserTenantsService.DecryptValue<ulong>(x, tenant)).ToList();
            var sourceIds = encryptedSourceIds.Select(x => wiserTenantsService.DecryptValue<ulong>(x, tenant)).ToList();
            var linkTypeSettings = await wiserItemsService.GetLinkTypeSettingsAsync(linkType, sourceEntityType);
            var linkTablePrefix = wiserItemsService.GetTablePrefixForLink(linkTypeSettings);

            if (String.IsNullOrWhiteSpace(sourceEntityType))
            {
                sourceEntityType = linkTypeSettings.SourceEntityType;
            }

            var tablePrefix = String.IsNullOrWhiteSpace(sourceEntityType) ? "" : await wiserItemsService.GetTablePrefixForEntityAsync(sourceEntityType);

            clientDatabaseConnection.ClearParameters();
            clientDatabaseConnection.AddParameter("linkType", linkType);

            string query;
            if (linkTypeSettings.UseItemParentId)
            {
                if (destinationIds.Count != 1)
                {
                    return new ServiceResult<bool>
                    {
                        StatusCode = HttpStatusCode.BadRequest,
                        ErrorMessage = "Received more or less than 1 destination item ID for a link type that is set to use parent_item_id, this is not possible."
                    };
                }

                query = $@"UPDATE {tablePrefix}{WiserTableNames.WiserItem} SET parent_item_id = 0 WHERE id IN ({String.Join(",", sourceIds)})";
            }
            else
            {
                query = $@"DELETE FROM {linkTablePrefix}{WiserTableNames.WiserItemLink} WHERE type = ?linkType AND destination_item_id IN ({String.Join(",", destinationIds)}) AND item_id IN ({String.Join(",", sourceIds)});";
                
                if (setOrdering) // Set ordering for the remaining items.
                {
                    foreach (var destinationId in destinationIds)
                    {
                        query = $@"{query}SET @ordering = 0;
                                UPDATE {linkTablePrefix}{WiserTableNames.WiserItemLink} l
                                JOIN (
	                                SELECT id, (@ordering:=@ordering + 1) AS newordering
	                                FROM {linkTablePrefix}{WiserTableNames.WiserItemLink}
	                                WHERE destination_item_id = {destinationId.ToString()}
	                                AND type = ?linkType
	                                ORDER BY ordering
                                ) AS ord ON ord.id = l.id
                                SET l.ordering = ord.newordering;";
                    }
                }
            }

            await clientDatabaseConnection.ExecuteAsync(query);

            return new ServiceResult<bool>
            {
                StatusCode = HttpStatusCode.NoContent
            };
        }

        /// <inheritdoc />
        public async Task<ServiceResult<bool>> TranslateAllFieldsAsync(ClaimsIdentity identity, string encryptedId, TranslateItemRequestModel settings)
        {
            if (String.IsNullOrWhiteSpace(encryptedId))
            {
                throw new ArgumentNullException(nameof(encryptedId));
            }
            if (String.IsNullOrWhiteSpace(settings.SourceLanguageCode))
            {
                throw new ArgumentNullException(nameof(settings.SourceLanguageCode));
            }

            await clientDatabaseConnection.EnsureOpenConnectionForReadingAsync();
            var itemId = await wiserTenantsService.DecryptValue<ulong>(encryptedId, identity);
            var username = IdentityHelpers.GetUserName(identity, true);
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var tenant = await wiserTenantsService.GetSingleAsync(identity);
            var encryptionKey = tenant.ModelObject.EncryptionKey;

            try
            {
                // Get all item details that can be translated.
                var wiserItem = await wiserItemsService.GetItemDetailsAsync(itemId, userId: userId, entityType: settings.EntityType);
                var detailsWithSourceLanguage = wiserItem.Details.Where(detail => String.Equals(detail.LanguageCode, settings.SourceLanguageCode, StringComparison.OrdinalIgnoreCase) && detail.Value != null).ToList();
                if (!detailsWithSourceLanguage.Any())
                {
                    return new ServiceResult<bool>
                    {
                        ErrorMessage = $"Er zijn geen ingevulde velden gevonden met de taal '{settings.SourceLanguageCode}'. Heeft u het item opgeslagen?"
                    };
                }

                // Get
                var properties = await entityPropertiesService.GetPropertiesOfEntityAsync(identity, settings.EntityType);
                if (properties.StatusCode != HttpStatusCode.OK)
                {
                    return new ServiceResult<bool>
                    {
                        ErrorMessage = properties.ErrorMessage,
                        StatusCode = properties.StatusCode
                    };
                }

                // Build lists of texts to translate.
                var textPropertiesToTranslate = new List<WiserItemDetailModel>();
                var htmlPropertiesToTranslate = new List<WiserItemDetailModel>();
                foreach (var property in properties.ModelObject)
                {
                    var detailWithSourceLanguage = detailsWithSourceLanguage.SingleOrDefault(detail => String.Equals(detail.Key, property.PropertyName, StringComparison.OrdinalIgnoreCase));
                    if (detailWithSourceLanguage == null)
                    {
                        continue;
                    }

                    switch (property.InputType)
                    {
                        case EntityPropertyInputTypes.Input:
                        case EntityPropertyInputTypes.TextBox:
                            textPropertiesToTranslate.Add(detailWithSourceLanguage);
                            break;
                        case EntityPropertyInputTypes.HtmlEditor:
                            htmlPropertiesToTranslate.Add(detailWithSourceLanguage);
                            break;
                        default:
                            continue;
                    }
                }

                // If the user didn't supply any destination languages, get all languages from Wiser and use those.
                if (settings.TargetLanguageCodes == null || !settings.TargetLanguageCodes.Any())
                {
                    var languages = await languagesService.GetAllLanguagesAsync();
                    settings.TargetLanguageCodes = languages.Select(language => language.Code).ToList();
                }

                // Do all the translations.
                foreach (var targetLanguageCode in settings.TargetLanguageCodes)
                {
                    if (String.Equals(settings.SourceLanguageCode, targetLanguageCode, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    // Translate normal texts.
                    if (textPropertiesToTranslate.Any())
                    {
                        var translations = await googleTranslateService.TranslateTextAsync(textPropertiesToTranslate.Select(detail => detail.Value.ToString()), targetLanguageCode, settings.SourceLanguageCode);
                        if (translations.StatusCode != HttpStatusCode.OK)
                        {
                            return new ServiceResult<bool>
                            {
                                ErrorMessage = translations.ErrorMessage,
                                StatusCode = translations.StatusCode
                            };
                        }

                        for (var index = 0; index < translations.ModelObject.Count; index++)
                        {
                            var translatedValue = translations.ModelObject[index];
                            var originalItemDetail = textPropertiesToTranslate[index];

                            SaveTranslationInItem(wiserItem, originalItemDetail, targetLanguageCode, translatedValue);
                        }
                    }

                    // Translate HTML fields.
                    if (htmlPropertiesToTranslate.Any())
                    {
                        var translations = await googleTranslateService.TranslateHtmlAsync(htmlPropertiesToTranslate.Select(detail => detail.Value.ToString()), targetLanguageCode, settings.SourceLanguageCode);
                        if (translations.StatusCode != HttpStatusCode.OK)
                        {
                            return new ServiceResult<bool>
                            {
                                ErrorMessage = translations.ErrorMessage,
                                StatusCode = translations.StatusCode
                            };
                        }

                        for (var index = 0; index < translations.ModelObject.Count; index++)
                        {
                            var translatedValue = translations.ModelObject[index];
                            var originalItemDetail = htmlPropertiesToTranslate[index];

                            SaveTranslationInItem(wiserItem, originalItemDetail, targetLanguageCode, translatedValue);
                        }
                    }
                }

                // And finally save all translations in the database for the item.
                await wiserItemsService.UpdateAsync(itemId, wiserItem, userId, username, encryptionKey);
                return new ServiceResult<bool>
                {
                    StatusCode = HttpStatusCode.NoContent
                };
            }
            catch (InvalidAccessPermissionsException invalidAccessPermissionsException)
            {
                logger.LogWarning(invalidAccessPermissionsException, $"User tried to translate fields for item '{invalidAccessPermissionsException.ItemId}', but did not have the required permissions ({invalidAccessPermissionsException.Action}).");
                return new ServiceResult<bool>
                {
                    ErrorMessage = invalidAccessPermissionsException.Message,
                    StatusCode = HttpStatusCode.Forbidden
                };
            }
        }

        /// <inheritdoc />
        public async Task<ServiceResult<List<SearchResponseModel>>> SearchAsync(ClaimsIdentity identity, ulong parentId, SearchRequestModel data)
        {
            if (data == null)
            {
                throw new ArgumentNullException(nameof(data));
            }

            var searchFields = String.IsNullOrWhiteSpace(data.SearchFields) ? new List<string>() : data.SearchFields.Split(',').ToList();
            var tablePrefix = await wiserItemsService.GetTablePrefixForEntityAsync(data.EntityType);
            clientDatabaseConnection.AddParameter("parentId", parentId);
            clientDatabaseConnection.AddParameter("entityType", data.EntityType);
            clientDatabaseConnection.AddParameter("searchValue", data.SearchValue);
            clientDatabaseConnection.AddParameter("searchInTitle", data.SearchInTitle);
            clientDatabaseConnection.AddParameter("searchEverywhere", data.SearchEverywhere);
            clientDatabaseConnection.AddParameter("userId", IdentityHelpers.GetWiserUserId(identity));
            clientDatabaseConnection.AddParameter("hasSearchFields", searchFields.Any());

            var searchQueryPart = new StringBuilder();
            if (!String.IsNullOrWhiteSpace(data.SearchValue))
            {
                if (searchFields.Any())
                {
                    searchQueryPart.AppendLine($"(detail.key IN (${String.Join(",", searchFields.Select(f => f.ToMySqlSafeValue(true)))}) AND detail.value LIKE CONCAT('%', ?searchValue, '%'))");
                }

                if (data.SearchInTitle)
                {
                    if (searchFields.Any())
                    {
                        searchQueryPart.Append("OR ");
                    }

                    searchQueryPart.AppendLine("item.title LIKE CONCAT('%', ?searchValue, '%')");
                }
            }

            if (searchQueryPart.Length > 0)
            {
                searchQueryPart.Insert(0, "AND (");
                searchQueryPart.AppendLine(")");
            }

            var query = $@"SELECT 
	item.id,
	item.title
FROM {tablePrefix}{WiserTableNames.WiserItem} AS item
LEFT JOIN {WiserTableNames.WiserItemLink} AS link ON link.destination_item_id = ?parentId AND link.item_id = item.id
LEFT JOIN {tablePrefix}{WiserTableNames.WiserItemDetail} AS detail ON detail.item_id = item.id

# Check permissions. Default permissions are everything enabled, so if the user has no role or the role has no permissions on this item, they are allowed everything.
LEFT JOIN {WiserTableNames.WiserUserRoles} AS userRole ON userRole.user_id = ?userId
LEFT JOIN {WiserTableNames.WiserPermission} AS permission ON permission.role_id = userRole.role_id AND permission.item_id = item.id

WHERE (permission.id IS NULL OR (permission.permissions & 1) > 0)
AND item.entity_type = ?entityType
AND (?searchEverywhere = TRUE OR link.id IS NOT NULL)
{searchQueryPart}

GROUP BY item.id
ORDER BY link.ordering ASC, item.title ASC";
            var dataTable = await clientDatabaseConnection.GetAsync(query);

            var result = new List<SearchResponseModel>();
            foreach (DataRow dataRow in dataTable.Rows)
            {
                var searchResult = new SearchResponseModel
                {
                    Id = dataRow.Field<ulong>("id"),
                    Name = dataRow.Field<string>("title")
                };

                searchResult.EncryptedId = await wiserTenantsService.EncryptValue(searchResult.Id, identity);

                result.Add(searchResult);
            }

            return new ServiceResult<List<SearchResponseModel>>(result);
        }
        
        /// <inheritdocs />
        public async Task<ServiceResult<List<ContextMenuItem>>> GetContextMenuAsync(ClaimsIdentity identity, int moduleId, string encryptedItemId, string entityType)
        {
            var item = (await GetItemDetailsAsync(encryptedItemId, identity, entityType)).ModelObject;
            var userId = IdentityHelpers.GetWiserUserId(identity);
            var permissions = await wiserItemsService.GetUserItemPermissionsAsync(item.Id, userId, entityType);
            var settings = await wiserItemsService.GetEntityTypeSettingsAsync(entityType, moduleId);

            var menuItems = new List<ContextMenuItem>();

            if (item.ReadOnly ?? false)
            {
                return new ServiceResult<List<ContextMenuItem>>(menuItems);
            }
            
            if ((permissions & AccessRights.Update) > 0)
            {
                menuItems.Add(new ContextMenuItem()
                {
                    Text = $"'{item.Title}' hernoemen (F2)",
                    SpriteCssClass = "icon-rename",
                    Action = "RENAME_ITEM",
                    EntityType = item.EntityType
                });
            }

            if ((permissions & AccessRights.Create) > 0)
            {
                if (settings.AcceptedChildTypes.Count == 1)
                {
                    var childEntity = settings.AcceptedChildTypes.First();
                    var childSettings = await wiserItemsService.GetEntityTypeSettingsAsync(childEntity);

                    menuItems.Add(new ContextMenuItem()
                    {
                        Text = $"Nieuw(e) '{childEntity}' aanmaken (SHIFT+N)",
                        SpriteCssClass = childSettings.IconAdd,
                        Action = "CREATE_ITEM",
                        EntityType = item.EntityType
                    });
                }
                
                menuItems.Add(new ContextMenuItem()
                {
                    Text = $"'{item.Title}' dupliceren (SHIFT+D)",
                    SpriteCssClass = "icon-document-duplicate",
                    Action = "DUPLICATE_ITEM",
                    EntityType = item.EntityType
                });
            }

            if ((permissions & AccessRights.Update) > 0)
            {
                menuItems.Add(new ContextMenuItem()
                {
                    Text = "Publiceer naar live",
                    SpriteCssClass = "icon-globe",
                    Action = "PUBLISH_LIVE",
                    EntityType = item.EntityType
                });
                
                if (item.PublishedEnvironment == 0)
                {
                    menuItems.Add(new ContextMenuItem()
                    {
                        Text = $"{item.Title} tonen",
                        SpriteCssClass = "item-light-on",
                        Action = "PUBLISH_ITEM",
                        EntityType = item.EntityType
                    });
                }
                else
                {
                    menuItems.Add(new ContextMenuItem()
                    {
                        Text = $"{item.Title} verbergen",
                        SpriteCssClass = "item-light-off",
                        Action = "HIDE_ITEM",
                        EntityType = item.EntityType
                    });
                }
            }

            if ((permissions & AccessRights.Delete) > 0)
            {
                menuItems.Add(new ContextMenuItem()
                {
                    Text = $"{item.Title} verwijderen (DEL)",
                    SpriteCssClass = "icon-delete",
                    Action = "REMOVE_ITEM",
                    EntityType = item.EntityType
                });
            }

            return new ServiceResult<List<ContextMenuItem>>(menuItems);
        }

        /// <summary>
        /// Saves a translated field in a <see cref="WiserItemModel"/>. It will only do this if it doesn't have a value for that language yet.
        /// </summary>
        /// <param name="wiserItem">The item to save the value in.</param>
        /// <param name="originalItemDetail">The original <see cref="WiserItemDetailModel"/> that was translated to another language.</param>
        /// <param name="targetLanguageCode">The language code of the new value.</param>
        /// <param name="translatedValue">The translated value.</param>
        private static void SaveTranslationInItem(WiserItemModel wiserItem, WiserItemDetailModel originalItemDetail, string targetLanguageCode, TranslationResult translatedValue)
        {
            var targetLanguageDetail = wiserItem.Details.SingleOrDefault(detail => String.Equals(detail.Key, originalItemDetail.Key, StringComparison.OrdinalIgnoreCase) && String.Equals(detail.LanguageCode, targetLanguageCode));
            if (targetLanguageDetail == null)
            {
                targetLanguageDetail = new WiserItemDetailModel
                {
                    Changed = true,
                    Key = originalItemDetail.Key,
                    GroupName = originalItemDetail.GroupName,
                    LanguageCode = targetLanguageCode,
                    LinkType = originalItemDetail.LinkType,
                    ReadOnly = originalItemDetail.ReadOnly,
                    IsLinkProperty = originalItemDetail.IsLinkProperty,
                    ItemLinkId = originalItemDetail.ItemLinkId
                };

                wiserItem.Details.Add(targetLanguageDetail);
            }
            else if (!String.IsNullOrWhiteSpace(targetLanguageDetail.Value?.ToString()))
            {
                // Don't overwrite existing values, only translate fields that are still empty.
                return;
            }

            targetLanguageDetail.Value = translatedValue.TranslatedText;
        }

        private static string ReadTextResourceFromAssembly(string name)
        {
            using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream($"Api.Modules.Items.FieldTemplates.{name}");
            if (stream == null)
            {
                return "";
            }

            using var streamReader = new StreamReader(stream);
            return streamReader.ReadToEnd();
        }
    }
}