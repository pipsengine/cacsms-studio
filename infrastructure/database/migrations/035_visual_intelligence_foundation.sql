SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version = N'035')
  BEGIN
    CREATE TABLE cacsms.VisualGenerationRequests (
      VisualGenerationRequestId uniqueidentifier NOT NULL CONSTRAINT PK_VisualGenerationRequests PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ProductionId uniqueidentifier NOT NULL,
      SceneKey nvarchar(200) NOT NULL,
      RequestingModule nvarchar(64) NOT NULL CONSTRAINT DF_VisualGenerationRequests_RequestingModule DEFAULT N'storyboard',
      AssetType nvarchar(64) NOT NULL,
      Purpose nvarchar(256) NOT NULL,
      Priority nvarchar(32) NOT NULL CONSTRAINT DF_VisualGenerationRequests_Priority DEFAULT N'NORMAL',
      Status nvarchar(32) NOT NULL CONSTRAINT DF_VisualGenerationRequests_Status DEFAULT N'ACTIVE',
      BriefHash nvarchar(64) NULL,
      ContextJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualGenerationRequests_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualGenerationRequests_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CreatedByAgent nvarchar(128) NOT NULL CONSTRAINT DF_VisualGenerationRequests_CreatedByAgent DEFAULT N'cacsms-visual-agent',
      UpdatedByAgent nvarchar(128) NOT NULL CONSTRAINT DF_VisualGenerationRequests_UpdatedByAgent DEFAULT N'cacsms-visual-agent',
      Version int NOT NULL CONSTRAINT DF_VisualGenerationRequests_Version DEFAULT 1,
      IsDeleted bit NOT NULL CONSTRAINT DF_VisualGenerationRequests_IsDeleted DEFAULT 0,
      RowVersion rowversion NOT NULL,
      CONSTRAINT FK_VisualGenerationRequests_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId) ON DELETE CASCADE,
      CONSTRAINT CK_VisualGenerationRequests_Priority CHECK (Priority IN (N'CRITICAL', N'HIGH', N'NORMAL', N'LOW', N'BACKGROUND')),
      CONSTRAINT CK_VisualGenerationRequests_Status CHECK (Status IN (N'ACTIVE', N'BLOCKED', N'COMPLETED', N'CANCELLED', N'DEAD_LETTER')),
      CONSTRAINT CK_VisualGenerationRequests_ContextJson CHECK (ContextJson IS NULL OR ISJSON(ContextJson) = 1)
    );
    CREATE UNIQUE INDEX UX_VisualGenerationRequests_Production_Scene_Asset
      ON cacsms.VisualGenerationRequests(ProductionId, SceneKey, AssetType, IsDeleted);
    CREATE INDEX IX_VisualGenerationRequests_Status_Priority
      ON cacsms.VisualGenerationRequests(Status, Priority, UpdatedAt DESC);

    CREATE TABLE cacsms.VisualGenerationStateHistory (
      VisualGenerationStateHistoryId uniqueidentifier NOT NULL CONSTRAINT PK_VisualGenerationStateHistory PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ImageGenerationJobId uniqueidentifier NOT NULL,
      VisualGenerationRequestId uniqueidentifier NULL,
      PreviousState nvarchar(32) NULL,
      NewState nvarchar(32) NOT NULL,
      Reason nvarchar(2000) NULL,
      Attempt int NOT NULL CONSTRAINT DF_VisualGenerationStateHistory_Attempt DEFAULT 0,
      WorkerName nvarchar(200) NULL,
      AgentName nvarchar(128) NOT NULL CONSTRAINT DF_VisualGenerationStateHistory_AgentName DEFAULT N'cacsms-visual-agent',
      ProviderName nvarchar(120) NULL,
      ModelName nvarchar(200) NULL,
      CorrelationId nvarchar(128) NULL,
      ErrorDetailsJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualGenerationStateHistory_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_VisualGenerationStateHistory_Job FOREIGN KEY (ImageGenerationJobId) REFERENCES cacsms.ImageGenerationJobs(ImageGenerationJobId) ON DELETE CASCADE,
      CONSTRAINT FK_VisualGenerationStateHistory_Request FOREIGN KEY (VisualGenerationRequestId) REFERENCES cacsms.VisualGenerationRequests(VisualGenerationRequestId),
      CONSTRAINT CK_VisualGenerationStateHistory_ErrorDetailsJson CHECK (ErrorDetailsJson IS NULL OR ISJSON(ErrorDetailsJson) = 1)
    );
    CREATE INDEX IX_VisualGenerationStateHistory_Job_CreatedAt
      ON cacsms.VisualGenerationStateHistory(ImageGenerationJobId, CreatedAt DESC);

    CREATE TABLE cacsms.VisualBriefs (
      VisualBriefId uniqueidentifier NOT NULL CONSTRAINT PK_VisualBriefs PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      VisualGenerationRequestId uniqueidentifier NOT NULL,
      ProductionId uniqueidentifier NOT NULL,
      SceneKey nvarchar(200) NOT NULL,
      CurrentVersion int NOT NULL CONSTRAINT DF_VisualBriefs_CurrentVersion DEFAULT 1,
      Status nvarchar(32) NOT NULL CONSTRAINT DF_VisualBriefs_Status DEFAULT N'ACTIVE',
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualBriefs_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualBriefs_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CreatedByAgent nvarchar(128) NOT NULL CONSTRAINT DF_VisualBriefs_CreatedByAgent DEFAULT N'cacsms-visual-agent',
      UpdatedByAgent nvarchar(128) NOT NULL CONSTRAINT DF_VisualBriefs_UpdatedByAgent DEFAULT N'cacsms-visual-agent',
      Version int NOT NULL CONSTRAINT DF_VisualBriefs_Version DEFAULT 1,
      RowVersion rowversion NOT NULL,
      CONSTRAINT FK_VisualBriefs_Request FOREIGN KEY (VisualGenerationRequestId) REFERENCES cacsms.VisualGenerationRequests(VisualGenerationRequestId) ON DELETE CASCADE,
      CONSTRAINT FK_VisualBriefs_Production FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId)
    );
    CREATE UNIQUE INDEX UX_VisualBriefs_Request
      ON cacsms.VisualBriefs(VisualGenerationRequestId);

    CREATE TABLE cacsms.VisualBriefVersions (
      VisualBriefVersionId uniqueidentifier NOT NULL CONSTRAINT PK_VisualBriefVersions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      VisualBriefId uniqueidentifier NOT NULL,
      VersionNumber int NOT NULL,
      BriefJson nvarchar(max) NOT NULL,
      RequiredElementsJson nvarchar(max) NULL,
      ProhibitedElementsJson nvarchar(max) NULL,
      EvidenceJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualBriefVersions_CreatedAt DEFAULT SYSUTCDATETIME(),
      CreatedByAgent nvarchar(128) NOT NULL CONSTRAINT DF_VisualBriefVersions_CreatedByAgent DEFAULT N'cacsms-visual-agent',
      CONSTRAINT FK_VisualBriefVersions_Brief FOREIGN KEY (VisualBriefId) REFERENCES cacsms.VisualBriefs(VisualBriefId) ON DELETE CASCADE,
      CONSTRAINT UQ_VisualBriefVersions_Brief_Version UNIQUE (VisualBriefId, VersionNumber),
      CONSTRAINT CK_VisualBriefVersions_BriefJson CHECK (ISJSON(BriefJson) = 1),
      CONSTRAINT CK_VisualBriefVersions_RequiredElementsJson CHECK (RequiredElementsJson IS NULL OR ISJSON(RequiredElementsJson) = 1),
      CONSTRAINT CK_VisualBriefVersions_ProhibitedElementsJson CHECK (ProhibitedElementsJson IS NULL OR ISJSON(ProhibitedElementsJson) = 1),
      CONSTRAINT CK_VisualBriefVersions_EvidenceJson CHECK (EvidenceJson IS NULL OR ISJSON(EvidenceJson) = 1)
    );

    CREATE TABLE cacsms.VisualPrompts (
      VisualPromptId uniqueidentifier NOT NULL CONSTRAINT PK_VisualPrompts PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      VisualBriefId uniqueidentifier NOT NULL,
      CurrentVersion int NOT NULL CONSTRAINT DF_VisualPrompts_CurrentVersion DEFAULT 1,
      Status nvarchar(32) NOT NULL CONSTRAINT DF_VisualPrompts_Status DEFAULT N'ACTIVE',
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualPrompts_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualPrompts_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CreatedByAgent nvarchar(128) NOT NULL CONSTRAINT DF_VisualPrompts_CreatedByAgent DEFAULT N'cacsms-visual-agent',
      UpdatedByAgent nvarchar(128) NOT NULL CONSTRAINT DF_VisualPrompts_UpdatedByAgent DEFAULT N'cacsms-visual-agent',
      Version int NOT NULL CONSTRAINT DF_VisualPrompts_Version DEFAULT 1,
      RowVersion rowversion NOT NULL,
      CONSTRAINT FK_VisualPrompts_Brief FOREIGN KEY (VisualBriefId) REFERENCES cacsms.VisualBriefs(VisualBriefId) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX UX_VisualPrompts_Brief
      ON cacsms.VisualPrompts(VisualBriefId);

    CREATE TABLE cacsms.VisualPromptVersions (
      VisualPromptVersionId uniqueidentifier NOT NULL CONSTRAINT PK_VisualPromptVersions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      VisualPromptId uniqueidentifier NOT NULL,
      VersionNumber int NOT NULL,
      CanonicalPrompt nvarchar(max) NOT NULL,
      ModelSpecificPrompt nvarchar(max) NOT NULL,
      NegativePrompt nvarchar(max) NULL,
      ValidationJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualPromptVersions_CreatedAt DEFAULT SYSUTCDATETIME(),
      CreatedByAgent nvarchar(128) NOT NULL CONSTRAINT DF_VisualPromptVersions_CreatedByAgent DEFAULT N'cacsms-visual-agent',
      CONSTRAINT FK_VisualPromptVersions_Prompt FOREIGN KEY (VisualPromptId) REFERENCES cacsms.VisualPrompts(VisualPromptId) ON DELETE CASCADE,
      CONSTRAINT UQ_VisualPromptVersions_Prompt_Version UNIQUE (VisualPromptId, VersionNumber),
      CONSTRAINT CK_VisualPromptVersions_ValidationJson CHECK (ValidationJson IS NULL OR ISJSON(ValidationJson) = 1)
    );

    CREATE TABLE cacsms.VisualModelProviders (
      VisualModelProviderId uniqueidentifier NOT NULL CONSTRAINT PK_VisualModelProviders PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ProviderKey nvarchar(64) NOT NULL,
      DisplayName nvarchar(128) NOT NULL,
      Status nvarchar(32) NOT NULL CONSTRAINT DF_VisualModelProviders_Status DEFAULT N'HEALTHY',
      CircuitBreakerState nvarchar(32) NOT NULL CONSTRAINT DF_VisualModelProviders_CircuitBreakerState DEFAULT N'CLOSED',
      ConfigJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualModelProviders_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualModelProviders_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_VisualModelProviders_ProviderKey UNIQUE (ProviderKey),
      CONSTRAINT CK_VisualModelProviders_Status CHECK (Status IN (N'HEALTHY', N'DEGRADED', N'UNAVAILABLE', N'STARTING', N'UNKNOWN')),
      CONSTRAINT CK_VisualModelProviders_Circuit CHECK (CircuitBreakerState IN (N'CLOSED', N'OPEN', N'HALF_OPEN')),
      CONSTRAINT CK_VisualModelProviders_ConfigJson CHECK (ConfigJson IS NULL OR ISJSON(ConfigJson) = 1)
    );

    CREATE TABLE cacsms.VisualModels (
      VisualModelId uniqueidentifier NOT NULL CONSTRAINT PK_VisualModels PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      VisualModelProviderId uniqueidentifier NOT NULL,
      ModelKey nvarchar(128) NOT NULL,
      DisplayName nvarchar(200) NOT NULL,
      ModelVersion nvarchar(64) NULL,
      SupportsGeneration bit NOT NULL CONSTRAINT DF_VisualModels_SupportsGeneration DEFAULT 1,
      SupportsInpainting bit NOT NULL CONSTRAINT DF_VisualModels_SupportsInpainting DEFAULT 0,
      SupportsOutpainting bit NOT NULL CONSTRAINT DF_VisualModels_SupportsOutpainting DEFAULT 0,
      SupportsUpscaling bit NOT NULL CONSTRAINT DF_VisualModels_SupportsUpscaling DEFAULT 0,
      SupportsReferenceConditioning bit NOT NULL CONSTRAINT DF_VisualModels_SupportsReferenceConditioning DEFAULT 0,
      SupportsControlNet bit NOT NULL CONSTRAINT DF_VisualModels_SupportsControlNet DEFAULT 0,
      SupportsLoRA bit NOT NULL CONSTRAINT DF_VisualModels_SupportsLoRA DEFAULT 0,
      DeploymentType nvarchar(64) NOT NULL CONSTRAINT DF_VisualModels_DeploymentType DEFAULT N'local',
      HealthStatus nvarchar(32) NOT NULL CONSTRAINT DF_VisualModels_HealthStatus DEFAULT N'UNKNOWN',
      ConfigJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualModels_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualModels_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_VisualModels_Provider FOREIGN KEY (VisualModelProviderId) REFERENCES cacsms.VisualModelProviders(VisualModelProviderId) ON DELETE CASCADE,
      CONSTRAINT UQ_VisualModels_ModelKey UNIQUE (VisualModelProviderId, ModelKey),
      CONSTRAINT CK_VisualModels_HealthStatus CHECK (HealthStatus IN (N'HEALTHY', N'DEGRADED', N'UNAVAILABLE', N'STARTING', N'UNKNOWN')),
      CONSTRAINT CK_VisualModels_ConfigJson CHECK (ConfigJson IS NULL OR ISJSON(ConfigJson) = 1)
    );

    CREATE TABLE cacsms.VisualWorkflows (
      VisualWorkflowId uniqueidentifier NOT NULL CONSTRAINT PK_VisualWorkflows PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkflowKey nvarchar(128) NOT NULL,
      DisplayName nvarchar(200) NOT NULL,
      WorkflowType nvarchar(64) NOT NULL,
      ActiveStatus nvarchar(32) NOT NULL CONSTRAINT DF_VisualWorkflows_ActiveStatus DEFAULT N'active',
      DefinitionJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualWorkflows_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_VisualWorkflows_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_VisualWorkflows_WorkflowKey UNIQUE (WorkflowKey),
      CONSTRAINT CK_VisualWorkflows_ActiveStatus CHECK (ActiveStatus IN (N'active', N'inactive', N'deprecated')),
      CONSTRAINT CK_VisualWorkflows_DefinitionJson CHECK (DefinitionJson IS NULL OR ISJSON(DefinitionJson) = 1)
    );

    IF COL_LENGTH('cacsms.ImageGenerationJobs', 'VisualGenerationRequestId') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationJobs ADD VisualGenerationRequestId uniqueidentifier NULL;
      ALTER TABLE cacsms.ImageGenerationJobs ADD CONSTRAINT FK_ImageGenerationJobs_VisualRequest
        FOREIGN KEY (VisualGenerationRequestId) REFERENCES cacsms.VisualGenerationRequests(VisualGenerationRequestId);
    END;

    IF COL_LENGTH('cacsms.ImageGenerationJobs', 'QueuePriority') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationJobs ADD QueuePriority nvarchar(32) NOT NULL
        CONSTRAINT DF_ImageGenerationJobs_QueuePriority DEFAULT N'NORMAL';
      EXEC(N'
        ALTER TABLE cacsms.ImageGenerationJobs ADD CONSTRAINT CK_ImageGenerationJobs_QueuePriority
          CHECK (QueuePriority IN (N''CRITICAL'', N''HIGH'', N''NORMAL'', N''LOW'', N''BACKGROUND''));
      ');
    END;

    IF COL_LENGTH('cacsms.ImageGenerationJobs', 'GenerationStatus') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationJobs ADD GenerationStatus nvarchar(32) NOT NULL
        CONSTRAINT DF_ImageGenerationJobs_GenerationStatus DEFAULT N'NOT_STARTED';
    END;

    IF COL_LENGTH('cacsms.ImageGenerationJobs', 'TechnicalValidationStatus') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationJobs ADD TechnicalValidationStatus nvarchar(32) NOT NULL
        CONSTRAINT DF_ImageGenerationJobs_TechnicalValidationStatus DEFAULT N'NOT_STARTED';
    END;

    IF COL_LENGTH('cacsms.ImageGenerationJobs', 'QualityStatus') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationJobs ADD QualityStatus nvarchar(32) NOT NULL
        CONSTRAINT DF_ImageGenerationJobs_QualityStatus DEFAULT N'NOT_EVALUATED';
    END;

    IF COL_LENGTH('cacsms.ImageGenerationJobs', 'DeliveryStatus') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationJobs ADD DeliveryStatus nvarchar(32) NOT NULL
        CONSTRAINT DF_ImageGenerationJobs_DeliveryStatus DEFAULT N'NOT_STARTED';
    END;

    IF COL_LENGTH('cacsms.ImageGenerationJobs', 'BrowserAcknowledgementStatus') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationJobs ADD BrowserAcknowledgementStatus nvarchar(32) NOT NULL
        CONSTRAINT DF_ImageGenerationJobs_BrowserAcknowledgementStatus DEFAULT N'PENDING';
    END;

    IF COL_LENGTH('cacsms.ImageGenerationJobs', 'ClaimedAt') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationJobs ADD ClaimedAt datetimeoffset(0) NULL;
    END;

    IF COL_LENGTH('cacsms.ImageGenerationJobs', 'LeaseExpiresAt') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationJobs ADD LeaseExpiresAt datetimeoffset(0) NULL;
    END;

    IF COL_LENGTH('cacsms.ImageGenerationJobs', 'CorrelationId') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationJobs ADD CorrelationId nvarchar(128) NULL;
    END;

    IF COL_LENGTH('cacsms.ImageGenerationJobs', 'RowVersion') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationJobs ADD RowVersion rowversion;
    END;

    IF COL_LENGTH('cacsms.ImageGenerationAssets', 'TechnicalValidationJson') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationAssets ADD TechnicalValidationJson nvarchar(max) NULL;
      EXEC(N'
        ALTER TABLE cacsms.ImageGenerationAssets ADD CONSTRAINT CK_ImageGenerationAssets_TechnicalValidationJson
          CHECK (TechnicalValidationJson IS NULL OR ISJSON(TechnicalValidationJson) = 1);
      ');
    END;

    IF COL_LENGTH('cacsms.ImageGenerationAssets', 'ValidationStatus') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationAssets ADD ValidationStatus nvarchar(32) NOT NULL
        CONSTRAINT DF_ImageGenerationAssets_ValidationStatus DEFAULT N'NOT_VALIDATED';
    END;

    IF COL_LENGTH('cacsms.ImageGenerationAssets', 'CreatedByAgent') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationAssets ADD CreatedByAgent nvarchar(128) NOT NULL
        CONSTRAINT DF_ImageGenerationAssets_CreatedByAgent DEFAULT N'cacsms-visual-agent';
    END;

    IF COL_LENGTH('cacsms.ImageGenerationAssets', 'UpdatedByAgent') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationAssets ADD UpdatedByAgent nvarchar(128) NOT NULL
        CONSTRAINT DF_ImageGenerationAssets_UpdatedByAgent DEFAULT N'cacsms-visual-agent';
    END;

    IF COL_LENGTH('cacsms.ImageGenerationAssets', 'Version') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationAssets ADD Version int NOT NULL
        CONSTRAINT DF_ImageGenerationAssets_Version DEFAULT 1;
    END;

    IF COL_LENGTH('cacsms.ImageGenerationAssets', 'RowVersion') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationAssets ADD RowVersion rowversion;
    END;

    IF COL_LENGTH('cacsms.ImageGenerationVariants', 'PromptVersionNumber') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationVariants ADD PromptVersionNumber int NULL;
    END;

    IF COL_LENGTH('cacsms.ImageGenerationVariants', 'WorkflowKey') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationVariants ADD WorkflowKey nvarchar(128) NULL;
    END;

    IF COL_LENGTH('cacsms.ImageGenerationVariants', 'CreatedByAgent') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationVariants ADD CreatedByAgent nvarchar(128) NOT NULL
        CONSTRAINT DF_ImageGenerationVariants_CreatedByAgent DEFAULT N'cacsms-visual-agent';
    END;

    IF COL_LENGTH('cacsms.ImageGenerationVariants', 'UpdatedByAgent') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationVariants ADD UpdatedByAgent nvarchar(128) NOT NULL
        CONSTRAINT DF_ImageGenerationVariants_UpdatedByAgent DEFAULT N'cacsms-visual-agent';
    END;

    IF COL_LENGTH('cacsms.ImageGenerationVariants', 'Version') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationVariants ADD Version int NOT NULL
        CONSTRAINT DF_ImageGenerationVariants_Version DEFAULT 1;
    END;

    IF COL_LENGTH('cacsms.ImageGenerationVariants', 'RowVersion') IS NULL
    BEGIN
      ALTER TABLE cacsms.ImageGenerationVariants ADD RowVersion rowversion;
    END;

    INSERT cacsms.VisualModelProviders (ProviderKey, DisplayName, Status, CircuitBreakerState, ConfigJson)
    SELECT
      N'cacsms-local-neural-image-runtime',
      N'CACSMS Local Neural Image Runtime',
      N'UNKNOWN',
      N'CLOSED',
      N'{"runtime":"local-daemon-or-process","category":"phase-1-foundation"}'
    WHERE NOT EXISTS (
      SELECT 1 FROM cacsms.VisualModelProviders WHERE ProviderKey = N'cacsms-local-neural-image-runtime'
    );

    INSERT cacsms.VisualModels (
      VisualModelProviderId,
      ModelKey,
      DisplayName,
      ModelVersion,
      SupportsGeneration,
      SupportsInpainting,
      SupportsOutpainting,
      SupportsUpscaling,
      SupportsReferenceConditioning,
      SupportsControlNet,
      SupportsLoRA,
      DeploymentType,
      HealthStatus,
      ConfigJson
    )
    SELECT
      p.VisualModelProviderId,
      N'cacsms-local-photoreal-image-model',
      N'CACSMS Local Photoreal Image Model',
      N'phase-1',
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      N'local',
      N'UNKNOWN',
      N'{"purpose":"foundation-real-image-generation"}'
    FROM cacsms.VisualModelProviders p
    WHERE p.ProviderKey = N'cacsms-local-neural-image-runtime'
      AND NOT EXISTS (
        SELECT 1
        FROM cacsms.VisualModels m
        WHERE m.VisualModelProviderId = p.VisualModelProviderId
          AND m.ModelKey = N'cacsms-local-photoreal-image-model'
      );

    INSERT cacsms.VisualWorkflows (WorkflowKey, DisplayName, WorkflowType, ActiveStatus, DefinitionJson)
    SELECT
      N'photoreal-human',
      N'Photoreal Human Foundation Workflow',
      N'generation',
      N'active',
      N'{"mode":"photoreal-human","stage":"phase-1"}'
    WHERE NOT EXISTS (
      SELECT 1 FROM cacsms.VisualWorkflows WHERE WorkflowKey = N'photoreal-human'
    );

    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.VisualGenerationRequests TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.VisualGenerationStateHistory TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.VisualBriefs TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.VisualBriefVersions TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.VisualPrompts TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.VisualPromptVersions TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.VisualModelProviders TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.VisualModels TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.VisualWorkflows TO [$(ApplicationUser)];

    INSERT dbo.SchemaMigrations (Version, Name, Checksum)
    VALUES (
      N'035',
      N'Visual intelligence foundation schema',
      HASHBYTES('SHA2_256', N'035:Visual intelligence foundation schema:v1')
    );
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
