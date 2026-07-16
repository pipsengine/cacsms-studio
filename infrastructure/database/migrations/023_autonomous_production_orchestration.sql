SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'023')
  BEGIN
    ALTER TABLE cacsms.Productions ADD AutonomousSourceRecordId uniqueidentifier NULL;
    EXEC(N'ALTER TABLE cacsms.Productions ADD CONSTRAINT FK_Productions_AutonomousSourceRecord FOREIGN KEY(AutonomousSourceRecordId) REFERENCES cacsms.OpportunityOperationalRecords(RecordId)');
    EXEC(N'CREATE UNIQUE INDEX UX_Productions_AutonomousSourceRecord ON cacsms.Productions(AutonomousSourceRecordId) WHERE AutonomousSourceRecordId IS NOT NULL');

    CREATE TABLE cacsms.ProductionOrchestrationSettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_ProductionOrchestrationSettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_ProductionOrchestrationSettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_ProductionOrchestrationSettings_Interval DEFAULT 30,
      AlgorithmVersion nvarchar(100) NOT NULL CONSTRAINT DF_ProductionOrchestrationSettings_Algorithm DEFAULT N'adaptive-multimodal-production-orchestrator-v6',
      LaunchThreshold decimal(5,2) NOT NULL CONSTRAINT DF_ProductionOrchestrationSettings_Launch DEFAULT 78,
      MaximumRisk decimal(5,2) NOT NULL CONSTRAINT DF_ProductionOrchestrationSettings_Risk DEFAULT 32,
      MaxConcurrentProductions int NOT NULL CONSTRAINT DF_ProductionOrchestrationSettings_Concurrency DEFAULT 20,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionOrchestrationSettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ProductionOrchestrationSettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_ProductionOrchestrationSettings_Interval CHECK(RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_ProductionOrchestrationSettings_Launch CHECK(LaunchThreshold BETWEEN 50 AND 100 AND MaximumRisk BETWEEN 0 AND 60),
      CONSTRAINT CK_ProductionOrchestrationSettings_Concurrency CHECK(MaxConcurrentProductions BETWEEN 1 AND 200)
    );

    CREATE TABLE cacsms.ProductionOrchestrationRuns (
      ProductionOrchestrationRunId uniqueidentifier NOT NULL CONSTRAINT PK_ProductionOrchestrationRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      CandidatesScanned int NOT NULL CONSTRAINT DF_ProductionOrchestrationRuns_Scanned DEFAULT 0,
      ProductionsGenerated int NOT NULL CONSTRAINT DF_ProductionOrchestrationRuns_Generated DEFAULT 0,
      ProductionsAdvanced int NOT NULL CONSTRAINT DF_ProductionOrchestrationRuns_Advanced DEFAULT 0,
      ProductionsCompleted int NOT NULL CONSTRAINT DF_ProductionOrchestrationRuns_Completed DEFAULT 0,
      CandidatesHeld int NOT NULL CONSTRAINT DF_ProductionOrchestrationRuns_Held DEFAULT 0,
      DuplicatesSuppressed int NOT NULL CONSTRAINT DF_ProductionOrchestrationRuns_Duplicates DEFAULT 0,
      AgentsAllocated int NOT NULL CONSTRAINT DF_ProductionOrchestrationRuns_Agents DEFAULT 0,
      AverageReadiness decimal(5,2) NOT NULL CONSTRAINT DF_ProductionOrchestrationRuns_Readiness DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_ProductionOrchestrationRuns_Confidence DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionOrchestrationRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_ProductionOrchestrationRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_ProductionOrchestrationRuns_Status CHECK(Status IN(N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_ProductionOrchestrationRuns_Workspace_Started ON cacsms.ProductionOrchestrationRuns(WorkspaceId,StartedAt DESC);

    CREATE TABLE cacsms.ProductionOrchestrationDecisions (
      ProductionOrchestrationDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductionOrchestrationDecisions PRIMARY KEY,
      ProductionOrchestrationRunId uniqueidentifier NOT NULL,
      ProductionId uniqueidentifier NULL,
      SourceRecommendationId uniqueidentifier NULL,
      Action nvarchar(70) NOT NULL,
      ReadinessScore decimal(5,2) NOT NULL,
      RiskScore decimal(5,2) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      SelectedFormat nvarchar(100) NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionOrchestrationDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ProductionOrchestrationDecisions_Run FOREIGN KEY(ProductionOrchestrationRunId) REFERENCES cacsms.ProductionOrchestrationRuns(ProductionOrchestrationRunId),
      CONSTRAINT FK_ProductionOrchestrationDecisions_Production FOREIGN KEY(ProductionId) REFERENCES cacsms.Productions(ProductionId),
      CONSTRAINT FK_ProductionOrchestrationDecisions_Source FOREIGN KEY(SourceRecommendationId) REFERENCES cacsms.OpportunityOperationalRecords(RecordId),
      CONSTRAINT CK_ProductionOrchestrationDecisions_Scores CHECK(ReadinessScore BETWEEN 0 AND 100 AND RiskScore BETWEEN 0 AND 100 AND Confidence BETWEEN 0 AND 100),
      CONSTRAINT CK_ProductionOrchestrationDecisions_Rationale CHECK(ISJSON(RationaleJson)=1)
    );
    CREATE INDEX IX_ProductionOrchestrationDecisions_Run ON cacsms.ProductionOrchestrationDecisions(ProductionOrchestrationRunId,CreatedAt DESC);

    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.ProductionOrchestrationSettings TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.ProductionOrchestrationRuns TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.ProductionOrchestrationDecisions TO [$(ApplicationUser)];

    DECLARE @WorkspaceId uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    IF @WorkspaceId IS NULL THROW 50023,N'An active workspace is required.',1;
    INSERT cacsms.ProductionOrchestrationSettings(WorkspaceId,Enabled,RunIntervalSeconds,AlgorithmVersion,LaunchThreshold,MaximumRisk,MaxConcurrentProductions,NextRunAt)
    VALUES(@WorkspaceId,1,30,N'adaptive-multimodal-production-orchestrator-v6',78,32,20,SYSUTCDATETIME());

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'023',N'Autonomous production orchestration',HASHBYTES('SHA2_256',N'023:Autonomous production orchestration:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
