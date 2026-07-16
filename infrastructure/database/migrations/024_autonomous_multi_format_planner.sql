SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'024')
  BEGIN
    CREATE TABLE cacsms.MultiFormatAutonomySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_MultiFormatAutonomySettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_MultiFormatAutonomySettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_MultiFormatAutonomySettings_Interval DEFAULT 30,
      AlgorithmVersion nvarchar(100) NOT NULL CONSTRAINT DF_MultiFormatAutonomySettings_Algorithm DEFAULT N'narrative-consistency-adaptation-orchestrator-v5',
      ReadyThreshold decimal(5,2) NOT NULL CONSTRAINT DF_MultiFormatAutonomySettings_Ready DEFAULT 82,
      OptimizeThreshold decimal(5,2) NOT NULL CONSTRAINT DF_MultiFormatAutonomySettings_Optimize DEFAULT 90,
      MaximumRisk decimal(5,2) NOT NULL CONSTRAINT DF_MultiFormatAutonomySettings_Risk DEFAULT 32,
      MaxVariantsPerMaster int NOT NULL CONSTRAINT DF_MultiFormatAutonomySettings_Variants DEFAULT 4,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_MultiFormatAutonomySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_MultiFormatAutonomySettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_MultiFormatAutonomySettings_Interval CHECK(RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_MultiFormatAutonomySettings_Thresholds CHECK(ReadyThreshold BETWEEN 50 AND OptimizeThreshold AND OptimizeThreshold <= 100 AND MaximumRisk BETWEEN 0 AND 60),
      CONSTRAINT CK_MultiFormatAutonomySettings_Variants CHECK(MaxVariantsPerMaster BETWEEN 1 AND 8)
    );

    CREATE TABLE cacsms.MultiFormatAutonomyRuns (
      MultiFormatAutonomyRunId uniqueidentifier NOT NULL CONSTRAINT PK_MultiFormatAutonomyRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      MastersScanned int NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Masters DEFAULT 0,
      VariantsGenerated int NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Generated DEFAULT 0,
      VariantsUpdated int NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Updated DEFAULT 0,
      VariantsReady int NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Ready DEFAULT 0,
      VariantsOptimized int NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Optimized DEFAULT 0,
      VariantsHeld int NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Held DEFAULT 0,
      DuplicatesSuppressed int NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Duplicates DEFAULT 0,
      ChannelCoverage decimal(5,2) NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Coverage DEFAULT 0,
      ReuseEfficiency decimal(5,2) NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Reuse DEFAULT 0,
      AverageAdaptationQuality decimal(5,2) NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Quality DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Confidence DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_MultiFormatAutonomyRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_MultiFormatAutonomyRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_MultiFormatAutonomyRuns_Status CHECK(Status IN(N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_MultiFormatAutonomyRuns_Workspace_Started ON cacsms.MultiFormatAutonomyRuns(WorkspaceId,StartedAt DESC);

    CREATE TABLE cacsms.MultiFormatAutonomyDecisions (
      MultiFormatAutonomyDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_MultiFormatAutonomyDecisions PRIMARY KEY,
      MultiFormatAutonomyRunId uniqueidentifier NOT NULL,
      RecordId uniqueidentifier NULL,
      SourceProductionId uniqueidentifier NOT NULL,
      Action nvarchar(60) NOT NULL,
      AdaptationScore decimal(5,2) NOT NULL,
      NarrativeConsistency decimal(5,2) NOT NULL,
      ChannelFit decimal(5,2) NOT NULL,
      AudienceFit decimal(5,2) NOT NULL,
      ReuseScore decimal(5,2) NOT NULL,
      RiskScore decimal(5,2) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      SelectedFormat nvarchar(100) NOT NULL,
      TargetChannel nvarchar(100) NOT NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_MultiFormatAutonomyDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_MultiFormatAutonomyDecisions_Run FOREIGN KEY(MultiFormatAutonomyRunId) REFERENCES cacsms.MultiFormatAutonomyRuns(MultiFormatAutonomyRunId),
      CONSTRAINT FK_MultiFormatAutonomyDecisions_Record FOREIGN KEY(RecordId) REFERENCES cacsms.OpportunityOperationalRecords(RecordId),
      CONSTRAINT FK_MultiFormatAutonomyDecisions_Production FOREIGN KEY(SourceProductionId) REFERENCES cacsms.Productions(ProductionId)
    );
    CREATE INDEX IX_MultiFormatAutonomyDecisions_Run ON cacsms.MultiFormatAutonomyDecisions(MultiFormatAutonomyRunId,CreatedAt DESC);
    CREATE INDEX IX_MultiFormatAutonomyDecisions_Source ON cacsms.MultiFormatAutonomyDecisions(SourceProductionId,CreatedAt DESC);

    INSERT cacsms.MultiFormatAutonomySettings(WorkspaceId)
      SELECT WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active';
    UPDATE cacsms.OpportunityOperationalRecords SET Status=N'Autonomous adapting',OwnerName=N'Multi-Format Autonomy Engine',UpdatedAt=SYSUTCDATETIME()
      WHERE PageSlug=N'multi-format-planner';

    IF EXISTS(SELECT 1 FROM sys.database_principals WHERE name=N'CACSMS_ApplicationUser')
    BEGIN
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.MultiFormatAutonomySettings TO CACSMS_ApplicationUser;
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.MultiFormatAutonomyRuns TO CACSMS_ApplicationUser;
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.MultiFormatAutonomyDecisions TO CACSMS_ApplicationUser;
    END;
    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
      VALUES(N'024',N'Autonomous multi-format adaptation planner',HASHBYTES('SHA2_256',N'024:Autonomous multi-format adaptation planner:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
