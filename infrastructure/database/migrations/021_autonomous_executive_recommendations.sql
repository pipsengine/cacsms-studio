SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'021')
  BEGIN
    CREATE TABLE cacsms.ExecutiveRecommendationAutonomySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_ExecutiveRecommendationAutonomySettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomySettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomySettings_Interval DEFAULT 30,
      AlgorithmVersion nvarchar(100) NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomySettings_Algorithm DEFAULT N'risk-adjusted-executive-orchestrator-v5',
      CommitThreshold decimal(5,2) NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomySettings_Commit DEFAULT 78,
      ExecuteThreshold decimal(5,2) NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomySettings_Execute DEFAULT 86,
      MaximumRisk decimal(5,2) NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomySettings_Risk DEFAULT 30,
      AllocationRate decimal(5,4) NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomySettings_Allocation DEFAULT 0.0800,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ExecutiveRecommendationAutonomySettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_ExecutiveRecommendationAutonomySettings_Interval CHECK(RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_ExecutiveRecommendationAutonomySettings_Thresholds CHECK(CommitThreshold BETWEEN 50 AND ExecuteThreshold AND ExecuteThreshold <= 100 AND MaximumRisk BETWEEN 0 AND 60),
      CONSTRAINT CK_ExecutiveRecommendationAutonomySettings_Allocation CHECK(AllocationRate BETWEEN 0.001 AND 0.5)
    );

    CREATE TABLE cacsms.ExecutiveRecommendationAutonomyRuns (
      ExecutiveRecommendationRunId uniqueidentifier NOT NULL CONSTRAINT PK_ExecutiveRecommendationAutonomyRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      CandidatesScanned int NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyRuns_Scanned DEFAULT 0,
      RecordsIngested int NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyRuns_Ingested DEFAULT 0,
      RecordsUpdated int NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyRuns_Updated DEFAULT 0,
      RecordsCommitted int NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyRuns_Committed DEFAULT 0,
      RecordsExecuting int NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyRuns_Executing DEFAULT 0,
      RecordsDeferred int NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyRuns_Deferred DEFAULT 0,
      DuplicatesSuppressed int NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyRuns_Duplicates DEFAULT 0,
      StrategicValue decimal(5,2) NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyRuns_Value DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyRuns_Confidence DEFAULT 0,
      InvestmentCommitted decimal(18,2) NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyRuns_Investment DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_ExecutiveRecommendationAutonomyRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_ExecutiveRecommendationAutonomyRuns_Status CHECK(Status IN(N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_ExecutiveRecommendationAutonomyRuns_Workspace_Started ON cacsms.ExecutiveRecommendationAutonomyRuns(WorkspaceId,StartedAt DESC);

    CREATE TABLE cacsms.ExecutiveRecommendationAutonomyDecisions (
      ExecutiveRecommendationDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ExecutiveRecommendationAutonomyDecisions PRIMARY KEY,
      ExecutiveRecommendationRunId uniqueidentifier NOT NULL,
      RecordId uniqueidentifier NULL,
      SourceEditorialRecordId uniqueidentifier NULL,
      Action nvarchar(60) NOT NULL,
      UtilityScore decimal(5,2) NOT NULL,
      RiskScore decimal(5,2) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      InvestmentAllocation decimal(18,2) NOT NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ExecutiveRecommendationAutonomyDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ExecutiveRecommendationAutonomyDecisions_Run FOREIGN KEY(ExecutiveRecommendationRunId) REFERENCES cacsms.ExecutiveRecommendationAutonomyRuns(ExecutiveRecommendationRunId),
      CONSTRAINT FK_ExecutiveRecommendationAutonomyDecisions_Record FOREIGN KEY(RecordId) REFERENCES cacsms.OpportunityOperationalRecords(RecordId),
      CONSTRAINT FK_ExecutiveRecommendationAutonomyDecisions_Source FOREIGN KEY(SourceEditorialRecordId) REFERENCES cacsms.OpportunityOperationalRecords(RecordId),
      CONSTRAINT CK_ExecutiveRecommendationAutonomyDecisions_Scores CHECK(UtilityScore BETWEEN 0 AND 100 AND RiskScore BETWEEN 0 AND 100 AND Confidence BETWEEN 0 AND 100),
      CONSTRAINT CK_ExecutiveRecommendationAutonomyDecisions_Allocation CHECK(InvestmentAllocation >= 0),
      CONSTRAINT CK_ExecutiveRecommendationAutonomyDecisions_Rationale CHECK(ISJSON(RationaleJson)=1)
    );
    CREATE INDEX IX_ExecutiveRecommendationAutonomyDecisions_Run ON cacsms.ExecutiveRecommendationAutonomyDecisions(ExecutiveRecommendationRunId,CreatedAt DESC);

    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.ExecutiveRecommendationAutonomySettings TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.ExecutiveRecommendationAutonomyRuns TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.ExecutiveRecommendationAutonomyDecisions TO [$(ApplicationUser)];

    DECLARE @WorkspaceId uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    IF @WorkspaceId IS NULL THROW 50021,N'An active workspace is required.',1;
    INSERT cacsms.ExecutiveRecommendationAutonomySettings(WorkspaceId,Enabled,RunIntervalSeconds,AlgorithmVersion,CommitThreshold,ExecuteThreshold,MaximumRisk,AllocationRate,NextRunAt)
    VALUES(@WorkspaceId,1,30,N'risk-adjusted-executive-orchestrator-v5',78,86,30,0.0800,SYSUTCDATETIME());

    UPDATE cacsms.OpportunityOperationalRecords SET Status=N'Autonomous monitoring',OwnerName=N'Executive Autonomy Engine',UpdatedAt=SYSUTCDATETIME()
    WHERE WorkspaceId=@WorkspaceId AND PageSlug=N'executive-recommendations' AND Status IN(N'Decision Required',N'Review',N'Approved',N'Deferred');

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'021',N'Autonomous executive recommendations',HASHBYTES('SHA2_256',N'021:Autonomous executive recommendations:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
