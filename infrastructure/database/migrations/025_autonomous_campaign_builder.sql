SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'025')
  BEGIN
    CREATE TABLE cacsms.CampaignAutonomySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_CampaignAutonomySettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_CampaignAutonomySettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_CampaignAutonomySettings_Interval DEFAULT 30,
      AlgorithmVersion nvarchar(100) NOT NULL CONSTRAINT DF_CampaignAutonomySettings_Algorithm DEFAULT N'multi-objective-campaign-orchestrator-v6',
      ScheduleThreshold decimal(5,2) NOT NULL CONSTRAINT DF_CampaignAutonomySettings_Schedule DEFAULT 82,
      LaunchThreshold decimal(5,2) NOT NULL CONSTRAINT DF_CampaignAutonomySettings_Launch DEFAULT 90,
      MaximumRisk decimal(5,2) NOT NULL CONSTRAINT DF_CampaignAutonomySettings_Risk DEFAULT 30,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_CampaignAutonomySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_CampaignAutonomySettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_CampaignAutonomySettings_Interval CHECK(RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_CampaignAutonomySettings_Thresholds CHECK(ScheduleThreshold BETWEEN 50 AND LaunchThreshold AND LaunchThreshold <= 100 AND MaximumRisk BETWEEN 0 AND 60)
    );

    CREATE TABLE cacsms.CampaignAutonomyRuns (
      CampaignAutonomyRunId uniqueidentifier NOT NULL CONSTRAINT PK_CampaignAutonomyRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      AssetsScanned int NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Scanned DEFAULT 0,
      CampaignsPlanned int NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Campaigns DEFAULT 0,
      AssetsGenerated int NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Generated DEFAULT 0,
      AssetsUpdated int NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Updated DEFAULT 0,
      AssetsScheduled int NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Scheduled DEFAULT 0,
      AssetsLaunched int NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Launched DEFAULT 0,
      AssetsHeld int NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Held DEFAULT 0,
      DuplicatesSuppressed int NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Duplicates DEFAULT 0,
      ProjectedReach bigint NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Reach DEFAULT 0,
      BudgetAllocated decimal(18,2) NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Budget DEFAULT 0,
      AverageLaunchReadiness decimal(5,2) NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Readiness DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Confidence DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_CampaignAutonomyRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_CampaignAutonomyRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_CampaignAutonomyRuns_Status CHECK(Status IN(N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_CampaignAutonomyRuns_Workspace_Started ON cacsms.CampaignAutonomyRuns(WorkspaceId,StartedAt DESC);

    CREATE TABLE cacsms.CampaignAutonomyDecisions (
      CampaignAutonomyDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_CampaignAutonomyDecisions PRIMARY KEY,
      CampaignAutonomyRunId uniqueidentifier NOT NULL,
      RecordId uniqueidentifier NOT NULL,
      SourceFormatRecordId uniqueidentifier NOT NULL,
      Action nvarchar(60) NOT NULL,
      CampaignKey nvarchar(100) NOT NULL,
      WaveName nvarchar(40) NOT NULL,
      LaunchReadiness decimal(5,2) NOT NULL,
      AudienceFit decimal(5,2) NOT NULL,
      ChannelSynergy decimal(5,2) NOT NULL,
      RiskScore decimal(5,2) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      ProjectedReach bigint NOT NULL,
      BudgetAllocation decimal(18,2) NOT NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_CampaignAutonomyDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_CampaignAutonomyDecisions_Run FOREIGN KEY(CampaignAutonomyRunId) REFERENCES cacsms.CampaignAutonomyRuns(CampaignAutonomyRunId),
      CONSTRAINT FK_CampaignAutonomyDecisions_Record FOREIGN KEY(RecordId) REFERENCES cacsms.OpportunityOperationalRecords(RecordId),
      CONSTRAINT FK_CampaignAutonomyDecisions_Source FOREIGN KEY(SourceFormatRecordId) REFERENCES cacsms.OpportunityOperationalRecords(RecordId)
    );
    CREATE INDEX IX_CampaignAutonomyDecisions_Run ON cacsms.CampaignAutonomyDecisions(CampaignAutonomyRunId,CreatedAt DESC);
    CREATE INDEX IX_CampaignAutonomyDecisions_Campaign ON cacsms.CampaignAutonomyDecisions(CampaignKey,CreatedAt DESC);

    INSERT cacsms.CampaignAutonomySettings(WorkspaceId) SELECT WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active';
    UPDATE cacsms.OpportunityOperationalRecords SET Status=N'Autonomous optimizing',OwnerName=N'Campaign Autonomy Engine',UpdatedAt=SYSUTCDATETIME() WHERE PageSlug=N'campaign-builder';
    IF EXISTS(SELECT 1 FROM sys.database_principals WHERE name=N'CACSMS_ApplicationUser')
    BEGIN
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.CampaignAutonomySettings TO CACSMS_ApplicationUser;
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.CampaignAutonomyRuns TO CACSMS_ApplicationUser;
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.CampaignAutonomyDecisions TO CACSMS_ApplicationUser;
    END;
    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
      VALUES(N'025',N'Autonomous campaign builder',HASHBYTES('SHA2_256',N'025:Autonomous campaign builder:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
