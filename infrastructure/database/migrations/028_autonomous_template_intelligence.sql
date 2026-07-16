SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'028')
  BEGIN
    CREATE TABLE cacsms.TemplateAutonomySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_TemplateAutonomySettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_TemplateAutonomySettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_TemplateAutonomySettings_Interval DEFAULT 30,
      AlgorithmVersion nvarchar(100) NOT NULL CONSTRAINT DF_TemplateAutonomySettings_Algorithm DEFAULT N'adaptive-template-intelligence-orchestrator-v5',
      ApproveThreshold decimal(5,2) NOT NULL CONSTRAINT DF_TemplateAutonomySettings_Approve DEFAULT 84,
      RefreshThreshold decimal(5,2) NOT NULL CONSTRAINT DF_TemplateAutonomySettings_Refresh DEFAULT 68,
      MaximumRisk decimal(5,2) NOT NULL CONSTRAINT DF_TemplateAutonomySettings_Risk DEFAULT 35,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_TemplateAutonomySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_TemplateAutonomySettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_TemplateAutonomySettings_Interval CHECK(RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_TemplateAutonomySettings_Thresholds CHECK(RefreshThreshold BETWEEN 0 AND ApproveThreshold AND ApproveThreshold <= 100 AND MaximumRisk BETWEEN 0 AND 70)
    );
    CREATE TABLE cacsms.TemplateAutonomyRuns (
      TemplateAutonomyRunId uniqueidentifier NOT NULL CONSTRAINT PK_TemplateAutonomyRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      ProductionsScanned int NOT NULL CONSTRAINT DF_TemplateAutonomyRuns_Scanned DEFAULT 0,
      TemplatesGenerated int NOT NULL CONSTRAINT DF_TemplateAutonomyRuns_Generated DEFAULT 0,
      TemplatesUpdated int NOT NULL CONSTRAINT DF_TemplateAutonomyRuns_Updated DEFAULT 0,
      TemplatesApproved int NOT NULL CONSTRAINT DF_TemplateAutonomyRuns_Approved DEFAULT 0,
      TemplatesRefreshing int NOT NULL CONSTRAINT DF_TemplateAutonomyRuns_Refreshing DEFAULT 0,
      TemplatesRetired int NOT NULL CONSTRAINT DF_TemplateAutonomyRuns_Retired DEFAULT 0,
      DuplicatesSuppressed int NOT NULL CONSTRAINT DF_TemplateAutonomyRuns_Duplicates DEFAULT 0,
      AverageFit decimal(5,2) NOT NULL CONSTRAINT DF_TemplateAutonomyRuns_Fit DEFAULT 0,
      AverageReuse decimal(5,2) NOT NULL CONSTRAINT DF_TemplateAutonomyRuns_Reuse DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_TemplateAutonomyRuns_Confidence DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_TemplateAutonomyRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_TemplateAutonomyRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_TemplateAutonomyRuns_Status CHECK(Status IN(N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_TemplateAutonomyRuns_Workspace_Started ON cacsms.TemplateAutonomyRuns(WorkspaceId,StartedAt DESC);
    CREATE TABLE cacsms.TemplateAutonomyDecisions (
      TemplateAutonomyDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_TemplateAutonomyDecisions PRIMARY KEY,
      TemplateAutonomyRunId uniqueidentifier NOT NULL,
      OperationalRecordId uniqueidentifier NULL,
      ProductionId uniqueidentifier NOT NULL,
      Action nvarchar(60) NOT NULL,
      TemplateKey nvarchar(120) NOT NULL,
      VersionNumber int NOT NULL,
      TemplateFit decimal(5,2) NOT NULL,
      ReuseScore decimal(5,2) NOT NULL,
      DriftScore decimal(5,2) NOT NULL,
      RiskScore decimal(5,2) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_TemplateAutonomyDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_TemplateAutonomyDecisions_Run FOREIGN KEY(TemplateAutonomyRunId) REFERENCES cacsms.TemplateAutonomyRuns(TemplateAutonomyRunId),
      CONSTRAINT FK_TemplateAutonomyDecisions_Operational FOREIGN KEY(OperationalRecordId) REFERENCES cacsms.OpportunityOperationalRecords(RecordId),
      CONSTRAINT FK_TemplateAutonomyDecisions_Production FOREIGN KEY(ProductionId) REFERENCES cacsms.Productions(ProductionId)
    );
    CREATE INDEX IX_TemplateAutonomyDecisions_Run ON cacsms.TemplateAutonomyDecisions(TemplateAutonomyRunId,CreatedAt DESC);
    CREATE INDEX IX_TemplateAutonomyDecisions_Key ON cacsms.TemplateAutonomyDecisions(TemplateKey,VersionNumber DESC);
    INSERT cacsms.TemplateAutonomySettings(WorkspaceId) SELECT WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active';
    IF EXISTS(SELECT 1 FROM sys.database_principals WHERE name=N'CACSMS_ApplicationUser')
    BEGIN
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.TemplateAutonomySettings TO CACSMS_ApplicationUser;
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.TemplateAutonomyRuns TO CACSMS_ApplicationUser;
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.TemplateAutonomyDecisions TO CACSMS_ApplicationUser;
    END;
    INSERT dbo.SchemaMigrations(Version,Name,Checksum) VALUES(N'028',N'Autonomous template intelligence',HASHBYTES('SHA2_256',N'028:Autonomous template intelligence:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
