SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'027')
  BEGIN
    CREATE TABLE cacsms.EvergreenAutonomySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_EvergreenAutonomySettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_EvergreenAutonomySettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_EvergreenAutonomySettings_Interval DEFAULT 30,
      AlgorithmVersion nvarchar(100) NOT NULL CONSTRAINT DF_EvergreenAutonomySettings_Algorithm DEFAULT N'evergreen-retention-reuse-orchestrator-v5',
      CertifyThreshold decimal(5,2) NOT NULL CONSTRAINT DF_EvergreenAutonomySettings_Certify DEFAULT 82,
      RefreshThreshold decimal(5,2) NOT NULL CONSTRAINT DF_EvergreenAutonomySettings_Refresh DEFAULT 60,
      MaximumRisk decimal(5,2) NOT NULL CONSTRAINT DF_EvergreenAutonomySettings_Risk DEFAULT 45,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_EvergreenAutonomySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_EvergreenAutonomySettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_EvergreenAutonomySettings_Interval CHECK(RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_EvergreenAutonomySettings_Thresholds CHECK(RefreshThreshold BETWEEN 0 AND CertifyThreshold AND CertifyThreshold <= 100 AND MaximumRisk BETWEEN 0 AND 70)
    );
    CREATE TABLE cacsms.EvergreenAutonomyRuns (
      EvergreenAutonomyRunId uniqueidentifier NOT NULL CONSTRAINT PK_EvergreenAutonomyRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      RecordsScanned int NOT NULL CONSTRAINT DF_EvergreenAutonomyRuns_Scanned DEFAULT 0,
      AssetsGenerated int NOT NULL CONSTRAINT DF_EvergreenAutonomyRuns_Generated DEFAULT 0,
      AssetsUpdated int NOT NULL CONSTRAINT DF_EvergreenAutonomyRuns_Updated DEFAULT 0,
      AssetsCertified int NOT NULL CONSTRAINT DF_EvergreenAutonomyRuns_Certified DEFAULT 0,
      RefreshQueued int NOT NULL CONSTRAINT DF_EvergreenAutonomyRuns_Refresh DEFAULT 0,
      DuplicatesSuppressed int NOT NULL CONSTRAINT DF_EvergreenAutonomyRuns_Duplicates DEFAULT 0,
      AssetsHeld int NOT NULL CONSTRAINT DF_EvergreenAutonomyRuns_Held DEFAULT 0,
      AverageFreshness decimal(5,2) NOT NULL CONSTRAINT DF_EvergreenAutonomyRuns_Freshness DEFAULT 0,
      AverageReuseReadiness decimal(5,2) NOT NULL CONSTRAINT DF_EvergreenAutonomyRuns_Reuse DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_EvergreenAutonomyRuns_Confidence DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_EvergreenAutonomyRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_EvergreenAutonomyRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_EvergreenAutonomyRuns_Status CHECK(Status IN(N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_EvergreenAutonomyRuns_Workspace_Started ON cacsms.EvergreenAutonomyRuns(WorkspaceId,StartedAt DESC);
    CREATE TABLE cacsms.EvergreenAutonomyDecisions (
      EvergreenAutonomyDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_EvergreenAutonomyDecisions PRIMARY KEY,
      EvergreenAutonomyRunId uniqueidentifier NOT NULL,
      KnowledgeRecordId uniqueidentifier NOT NULL,
      OperationalRecordId uniqueidentifier NULL,
      Action nvarchar(60) NOT NULL,
      EvergreenScore decimal(5,2) NOT NULL,
      FreshnessScore decimal(5,2) NOT NULL,
      ReuseReadiness decimal(5,2) NOT NULL,
      QualityScore decimal(5,2) NOT NULL,
      RiskScore decimal(5,2) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_EvergreenAutonomyDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_EvergreenAutonomyDecisions_Run FOREIGN KEY(EvergreenAutonomyRunId) REFERENCES cacsms.EvergreenAutonomyRuns(EvergreenAutonomyRunId),
      CONSTRAINT FK_EvergreenAutonomyDecisions_Knowledge FOREIGN KEY(KnowledgeRecordId) REFERENCES cacsms.KnowledgeRecords(KnowledgeRecordId),
      CONSTRAINT FK_EvergreenAutonomyDecisions_Operational FOREIGN KEY(OperationalRecordId) REFERENCES cacsms.OpportunityOperationalRecords(RecordId)
    );
    CREATE INDEX IX_EvergreenAutonomyDecisions_Run ON cacsms.EvergreenAutonomyDecisions(EvergreenAutonomyRunId,CreatedAt DESC);
    CREATE INDEX IX_EvergreenAutonomyDecisions_Knowledge ON cacsms.EvergreenAutonomyDecisions(KnowledgeRecordId,CreatedAt DESC);
    INSERT cacsms.EvergreenAutonomySettings(WorkspaceId) SELECT WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active';
    IF EXISTS(SELECT 1 FROM sys.database_principals WHERE name=N'CACSMS_ApplicationUser')
    BEGIN
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.EvergreenAutonomySettings TO CACSMS_ApplicationUser;
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.EvergreenAutonomyRuns TO CACSMS_ApplicationUser;
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.EvergreenAutonomyDecisions TO CACSMS_ApplicationUser;
    END;
    INSERT dbo.SchemaMigrations(Version,Name,Checksum) VALUES(N'027',N'Autonomous evergreen knowledge retention',HASHBYTES('SHA2_256',N'027:Autonomous evergreen knowledge retention:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
