SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version = N'031')
  BEGIN
    CREATE TABLE cacsms.ScriptWritingSettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_ScriptWritingSettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_ScriptWritingSettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_ScriptWritingSettings_RunInterval DEFAULT 30,
      QualityThreshold decimal(5,2) NOT NULL CONSTRAINT DF_ScriptWritingSettings_QualityThreshold DEFAULT 85,
      MinimumBriefLength int NOT NULL CONSTRAINT DF_ScriptWritingSettings_MinimumBriefLength DEFAULT 60,
      MinimumResearchSources int NOT NULL CONSTRAINT DF_ScriptWritingSettings_MinimumResearchSources DEFAULT 2,
      MinimumWordCount int NOT NULL CONSTRAINT DF_ScriptWritingSettings_MinimumWordCount DEFAULT 180,
      MaxRevisionAttempts int NOT NULL CONSTRAINT DF_ScriptWritingSettings_MaxRevisionAttempts DEFAULT 3,
      WriterModel nvarchar(120) NOT NULL CONSTRAINT DF_ScriptWritingSettings_WriterModel DEFAULT N'CACSMS Narrative Synthesis Engine v2',
      ReviewerModel nvarchar(120) NOT NULL CONSTRAINT DF_ScriptWritingSettings_ReviewerModel DEFAULT N'CACSMS Script Governance Engine v2',
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ScriptWritingSettings_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ScriptWritingSettings_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_ScriptWritingSettings_RunInterval CHECK (RunIntervalSeconds BETWEEN 15 AND 86400),
      CONSTRAINT CK_ScriptWritingSettings_QualityThreshold CHECK (QualityThreshold BETWEEN 50 AND 100),
      CONSTRAINT CK_ScriptWritingSettings_MinimumBriefLength CHECK (MinimumBriefLength BETWEEN 20 AND 500),
      CONSTRAINT CK_ScriptWritingSettings_MinimumResearchSources CHECK (MinimumResearchSources BETWEEN 1 AND 20),
      CONSTRAINT CK_ScriptWritingSettings_MinimumWordCount CHECK (MinimumWordCount BETWEEN 50 AND 5000),
      CONSTRAINT CK_ScriptWritingSettings_MaxRevisionAttempts CHECK (MaxRevisionAttempts BETWEEN 1 AND 10)
    );

    CREATE TABLE cacsms.ScriptWritingRuns (
      ScriptWritingRunId uniqueidentifier NOT NULL CONSTRAINT PK_ScriptWritingRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      ProductionId uniqueidentifier NOT NULL,
      JobId uniqueidentifier NOT NULL CONSTRAINT DF_ScriptWritingRuns_JobId DEFAULT NEWSEQUENTIALID(),
      TriggerSource nvarchar(40) NOT NULL,
      Status nvarchar(30) NOT NULL,
      CurrentAction nvarchar(200) NOT NULL,
      CurrentAgentName nvarchar(200) NULL,
      CurrentAgentRole nvarchar(100) NULL,
      ModelName nvarchar(120) NULL,
      RetryCount int NOT NULL CONSTRAINT DF_ScriptWritingRuns_RetryCount DEFAULT 0,
      WordCount int NOT NULL CONSTRAINT DF_ScriptWritingRuns_WordCount DEFAULT 0,
      QualityScore decimal(5,2) NOT NULL CONSTRAINT DF_ScriptWritingRuns_QualityScore DEFAULT 0,
      BriefValid bit NOT NULL CONSTRAINT DF_ScriptWritingRuns_BriefValid DEFAULT 0,
      ResearchSourceCount int NOT NULL CONSTRAINT DF_ScriptWritingRuns_ResearchSourceCount DEFAULT 0,
      VersionCount int NOT NULL CONSTRAINT DF_ScriptWritingRuns_VersionCount DEFAULT 0,
      MandatoryGatesPassed bit NOT NULL CONSTRAINT DF_ScriptWritingRuns_MandatoryGatesPassed DEFAULT 0,
      BlockerCode nvarchar(80) NULL,
      BlockerMessage nvarchar(1000) NULL,
      NextAction nvarchar(200) NULL,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ScriptWritingRuns_StartedAt DEFAULT SYSUTCDATETIME(),
      LastHeartbeatAt datetimeoffset(0) NULL,
      CompletedAt datetimeoffset(0) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ScriptWritingRuns_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ScriptWritingRuns_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ScriptWritingRuns_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_ScriptWritingRuns_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId) ON DELETE CASCADE,
      CONSTRAINT CK_ScriptWritingRuns_Status CHECK (Status IN (N'waiting', N'researching', N'queued', N'generating', N'reviewing', N'revising', N'blocked', N'retrying', N'failed', N'completed')),
      CONSTRAINT CK_ScriptWritingRuns_RetryCount CHECK (RetryCount >= 0),
      CONSTRAINT CK_ScriptWritingRuns_WordCount CHECK (WordCount >= 0),
      CONSTRAINT CK_ScriptWritingRuns_ResearchSourceCount CHECK (ResearchSourceCount >= 0),
      CONSTRAINT CK_ScriptWritingRuns_VersionCount CHECK (VersionCount >= 0),
      CONSTRAINT CK_ScriptWritingRuns_QualityScore CHECK (QualityScore BETWEEN 0 AND 100)
    );
    CREATE INDEX IX_ScriptWritingRuns_Production_CreatedAt ON cacsms.ScriptWritingRuns(ProductionId, CreatedAt DESC);
    CREATE INDEX IX_ScriptWritingRuns_Workspace_Status ON cacsms.ScriptWritingRuns(WorkspaceId, Status, UpdatedAt DESC);

    CREATE TABLE cacsms.ProductionScriptSections (
      ProductionScriptSectionId uniqueidentifier NOT NULL CONSTRAINT PK_ProductionScriptSections PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ScriptWritingRunId uniqueidentifier NOT NULL,
      ProductionId uniqueidentifier NOT NULL,
      SectionKey nvarchar(80) NOT NULL,
      Title nvarchar(200) NOT NULL,
      SequenceNo tinyint NOT NULL,
      Status nvarchar(30) NOT NULL CONSTRAINT DF_ProductionScriptSections_Status DEFAULT N'waiting',
      WordCount int NOT NULL CONSTRAINT DF_ProductionScriptSections_WordCount DEFAULT 0,
      CitationCount int NOT NULL CONSTRAINT DF_ProductionScriptSections_CitationCount DEFAULT 0,
      Content nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionScriptSections_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionScriptSections_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_ProductionScriptSections_Runs FOREIGN KEY (ScriptWritingRunId) REFERENCES cacsms.ScriptWritingRuns(ScriptWritingRunId) ON DELETE CASCADE,
      CONSTRAINT FK_ProductionScriptSections_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId),
      CONSTRAINT UQ_ProductionScriptSections_Run_SectionKey UNIQUE (ScriptWritingRunId, SectionKey),
      CONSTRAINT CK_ProductionScriptSections_Status CHECK (Status IN (N'waiting', N'queued', N'generating', N'reviewing', N'revising', N'blocked', N'failed', N'completed')),
      CONSTRAINT CK_ProductionScriptSections_WordCount CHECK (WordCount >= 0),
      CONSTRAINT CK_ProductionScriptSections_CitationCount CHECK (CitationCount >= 0)
    );
    CREATE INDEX IX_ProductionScriptSections_Production_Sequence ON cacsms.ProductionScriptSections(ProductionId, SequenceNo, UpdatedAt DESC);

    CREATE TABLE cacsms.ProductionScriptEvidence (
      ProductionScriptEvidenceId uniqueidentifier NOT NULL CONSTRAINT PK_ProductionScriptEvidence PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ScriptWritingRunId uniqueidentifier NOT NULL,
      ProductionId uniqueidentifier NOT NULL,
      ProductionScriptSectionId uniqueidentifier NULL,
      KnowledgeRecordId uniqueidentifier NULL,
      Citation nvarchar(500) NOT NULL,
      SourceTitle nvarchar(300) NOT NULL,
      SourceStatus nvarchar(30) NOT NULL,
      Confidence decimal(5,2) NOT NULL CONSTRAINT DF_ProductionScriptEvidence_Confidence DEFAULT 0,
      EvidenceText nvarchar(2000) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionScriptEvidence_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ProductionScriptEvidence_Runs FOREIGN KEY (ScriptWritingRunId) REFERENCES cacsms.ScriptWritingRuns(ScriptWritingRunId) ON DELETE CASCADE,
      CONSTRAINT FK_ProductionScriptEvidence_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId),
      CONSTRAINT FK_ProductionScriptEvidence_Sections FOREIGN KEY (ProductionScriptSectionId) REFERENCES cacsms.ProductionScriptSections(ProductionScriptSectionId),
      CONSTRAINT FK_ProductionScriptEvidence_KnowledgeRecords FOREIGN KEY (KnowledgeRecordId) REFERENCES cacsms.KnowledgeRecords(KnowledgeRecordId),
      CONSTRAINT CK_ProductionScriptEvidence_Confidence CHECK (Confidence BETWEEN 0 AND 100)
    );
    CREATE INDEX IX_ProductionScriptEvidence_Run_CreatedAt ON cacsms.ProductionScriptEvidence(ScriptWritingRunId, CreatedAt DESC);

    CREATE TABLE cacsms.ProductionScriptVersions (
      ProductionScriptVersionId uniqueidentifier NOT NULL CONSTRAINT PK_ProductionScriptVersions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ScriptWritingRunId uniqueidentifier NOT NULL,
      ProductionId uniqueidentifier NOT NULL,
      AttemptNumber int NOT NULL,
      Label nvarchar(200) NOT NULL,
      Content nvarchar(max) NOT NULL,
      WordCount int NOT NULL,
      QualityScore decimal(5,2) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionScriptVersions_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ProductionScriptVersions_Runs FOREIGN KEY (ScriptWritingRunId) REFERENCES cacsms.ScriptWritingRuns(ScriptWritingRunId) ON DELETE CASCADE,
      CONSTRAINT FK_ProductionScriptVersions_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId),
      CONSTRAINT CK_ProductionScriptVersions_AttemptNumber CHECK (AttemptNumber >= 1),
      CONSTRAINT CK_ProductionScriptVersions_WordCount CHECK (WordCount >= 0),
      CONSTRAINT CK_ProductionScriptVersions_QualityScore CHECK (QualityScore BETWEEN 0 AND 100)
    );
    CREATE INDEX IX_ProductionScriptVersions_Production_CreatedAt ON cacsms.ProductionScriptVersions(ProductionId, CreatedAt DESC);

    CREATE TABLE cacsms.ProductionScriptChecks (
      ProductionScriptCheckId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductionScriptChecks PRIMARY KEY,
      ScriptWritingRunId uniqueidentifier NOT NULL,
      ProductionId uniqueidentifier NOT NULL,
      AttemptNumber int NOT NULL,
      CheckType nvarchar(40) NOT NULL,
      Status nvarchar(30) NOT NULL,
      Score decimal(5,2) NOT NULL,
      Notes nvarchar(1000) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionScriptChecks_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ProductionScriptChecks_Runs FOREIGN KEY (ScriptWritingRunId) REFERENCES cacsms.ScriptWritingRuns(ScriptWritingRunId) ON DELETE CASCADE,
      CONSTRAINT FK_ProductionScriptChecks_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId),
      CONSTRAINT CK_ProductionScriptChecks_AttemptNumber CHECK (AttemptNumber >= 1),
      CONSTRAINT CK_ProductionScriptChecks_Type CHECK (CheckType IN (N'factual', N'editorial', N'brand', N'safety', N'compliance')),
      CONSTRAINT CK_ProductionScriptChecks_Status CHECK (Status IN (N'passed', N'failed', N'warning')),
      CONSTRAINT CK_ProductionScriptChecks_Score CHECK (Score BETWEEN 0 AND 100)
    );
    CREATE INDEX IX_ProductionScriptChecks_Production_CreatedAt ON cacsms.ProductionScriptChecks(ProductionId, CreatedAt DESC);

    CREATE TABLE cacsms.ProductionScriptDecisions (
      ProductionScriptDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductionScriptDecisions PRIMARY KEY,
      ScriptWritingRunId uniqueidentifier NOT NULL,
      ProductionId uniqueidentifier NOT NULL,
      Step nvarchar(80) NOT NULL,
      Action nvarchar(120) NOT NULL,
      Outcome nvarchar(80) NOT NULL,
      Reason nvarchar(1000) NULL,
      DataJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionScriptDecisions_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ProductionScriptDecisions_Runs FOREIGN KEY (ScriptWritingRunId) REFERENCES cacsms.ScriptWritingRuns(ScriptWritingRunId) ON DELETE CASCADE,
      CONSTRAINT FK_ProductionScriptDecisions_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId),
      CONSTRAINT CK_ProductionScriptDecisions_DataJson CHECK (DataJson IS NULL OR ISJSON(DataJson) = 1)
    );
    CREATE INDEX IX_ProductionScriptDecisions_Production_CreatedAt ON cacsms.ProductionScriptDecisions(ProductionId, CreatedAt DESC);

    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.ScriptWritingSettings TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.ScriptWritingRuns TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.ProductionScriptSections TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.ProductionScriptEvidence TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.ProductionScriptVersions TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.ProductionScriptChecks TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.ProductionScriptDecisions TO [$(ApplicationUser)];

    DECLARE @WorkspaceId uniqueidentifier = (
      SELECT TOP (1) WorkspaceId
      FROM cacsms.Workspaces
      WHERE Status = N'active'
      ORDER BY CreatedAt
    );
    IF @WorkspaceId IS NULL THROW 50031, N'An active workspace is required.', 1;

    INSERT cacsms.ScriptWritingSettings (
      WorkspaceId,
      Enabled,
      RunIntervalSeconds,
      QualityThreshold,
      MinimumBriefLength,
      MinimumResearchSources,
      MinimumWordCount,
      MaxRevisionAttempts,
      WriterModel,
      ReviewerModel,
      NextRunAt
    )
    VALUES (
      @WorkspaceId,
      1,
      30,
      85,
      60,
      2,
      180,
      3,
      N'CACSMS Narrative Synthesis Engine v2',
      N'CACSMS Script Governance Engine v2',
      SYSUTCDATETIME()
    );

    INSERT dbo.SchemaMigrations (Version, Name, Checksum)
    VALUES (
      N'031',
      N'Autonomous script writing orchestration',
      HASHBYTES('SHA2_256', N'031:Autonomous script writing orchestration:v1')
    );
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
