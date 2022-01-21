﻿using System;
using System.Collections.Generic;
using Api.Modules.Templates.Models.Other;

namespace Api.Modules.Templates.Models.Template
{
    public class TemplateDataModel
    {
        public int Templateid;
        public string Name;
        public string EditorValue;
        public int Version;
        public DateTime ChangedOn;
        public string ChangedBy;

        //Advanced settings
        public int UseCache;
        public int CacheMinutes;
        public bool HandleRequests;
        public bool HandleSession;
        public bool HandleObjects;
        public bool HandleStandards;
        public bool HandleTranslations;
        public bool HandleDynamicContent;
        public bool HandleLogicBlocks;
        public bool HandleMutators;
        public bool LoginRequired;
        public string LoginUserType;
        public string LoginSessionPrefix;
        public string LoginRole;

        public Dictionary<string, object> Changes;

        public LinkedTemplatesModel LinkedTemplates;
        public PublishedEnvironmentModel PublishedEnvironments { get; set; }
    }
}