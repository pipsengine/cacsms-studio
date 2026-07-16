SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'017')
  BEGIN
    CREATE TABLE cacsms.OpportunityScoringAutonomySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_OpportunityScoringAutonomySettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_OpportunityScoringAutonomySettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_OpportunityScoringAutonomySettings_Interval DEFAULT 30,
      AlgorithmVersion nvarchar(100) NOT NULL CONSTRAINT DF_OpportunityScoringAutonomySettings_Algorithm DEFAULT N'adaptive-opportunity-ensemble-v4',
      AutoPromoteThreshold decimal(5,2) NOT NULL CONSTRAINT DF_OpportunityScoringAutonomySettings_Promote DEFAULT 85,
      AutoPrioritizeThreshold decimal(5,2) NOT NULL CONSTRAINT DF_OpportunityScoringAutonomySettings_Prioritize DEFAULT 70,
      MaxCandidatesPerRun int NOT NULL CONSTRAINT DF_OpportunityScoringAutonomySettings_Max DEFAULT 100,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunityScoringAutonomySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_OpportunityScoringAutonomySettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_OpportunityScoringAutonomySettings_Interval CHECK(RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_OpportunityScoringAutonomySettings_Thresholds CHECK(AutoPromoteThreshold BETWEEN 70 AND 100 AND AutoPrioritizeThreshold BETWEEN 40 AND AutoPromoteThreshold),
      CONSTRAINT CK_OpportunityScoringAutonomySettings_Max CHECK(MaxCandidatesPerRun BETWEEN 1 AND 500)
    );

    CREATE TABLE cacsms.OpportunityScoringAutonomyRuns (
      OpportunityScoringRunId uniqueidentifier NOT NULL CONSTRAINT PK_OpportunityScoringAutonomyRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      CandidatesScanned int NOT NULL CONSTRAINT DF_OpportunityScoringAutonomyRuns_Scanned DEFAULT 0,
      RecordsCreated int NOT NULL CONSTRAINT DF_OpportunityScoringAutonomyRuns_Created DEFAULT 0,
      RecordsUpdated int NOT NULL CONSTRAINT DF_OpportunityScoringAutonomyRuns_Updated DEFAULT 0,
      RecordsPromoted int NOT NULL CONSTRAINT DF_OpportunityScoringAutonomyRuns_Promoted DEFAULT 0,
      RecordsEnriching int NOT NULL CONSTRAINT DF_OpportunityScoringAutonomyRuns_Enriching DEFAULT 0,
      AverageScore decimal(5,2) NOT NULL CONSTRAINT DF_OpportunityScoringAutonomyRuns_Average DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_OpportunityScoringAutonomyRuns_Confidence DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunityScoringAutonomyRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_OpportunityScoringAutonomyRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_OpportunityScoringAutonomyRuns_Status CHECK(Status IN(N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_OpportunityScoringAutonomyRuns_Workspace_Started ON cacsms.OpportunityScoringAutonomyRuns(WorkspaceId,StartedAt DESC);

    CREATE TABLE cacsms.OpportunityScoringAutonomyDecisions (
      OpportunityScoringDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_OpportunityScoringAutonomyDecisions PRIMARY KEY,
      OpportunityScoringRunId uniqueidentifier NOT NULL,
      IntelligenceItemId uniqueidentifier NULL,
      Action nvarchar(60) NOT NULL,
      Score decimal(5,2) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunityScoringAutonomyDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_OpportunityScoringAutonomyDecisions_Run FOREIGN KEY(OpportunityScoringRunId) REFERENCES cacsms.OpportunityScoringAutonomyRuns(OpportunityScoringRunId),
      CONSTRAINT FK_OpportunityScoringAutonomyDecisions_Item FOREIGN KEY(IntelligenceItemId) REFERENCES cacsms.IntelligenceItems(IntelligenceItemId),
      CONSTRAINT CK_OpportunityScoringAutonomyDecisions_Score CHECK(Score BETWEEN 0 AND 100),
      CONSTRAINT CK_OpportunityScoringAutonomyDecisions_Confidence CHECK(Confidence BETWEEN 0 AND 100),
      CONSTRAINT CK_OpportunityScoringAutonomyDecisions_Rationale CHECK(ISJSON(RationaleJson)=1)
    );
    CREATE INDEX IX_OpportunityScoringAutonomyDecisions_Run ON cacsms.OpportunityScoringAutonomyDecisions(OpportunityScoringRunId,CreatedAt DESC);

    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.OpportunityScoringAutonomySettings TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.OpportunityScoringAutonomyRuns TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.OpportunityScoringAutonomyDecisions TO [$(ApplicationUser)];

    DECLARE @WorkspaceId uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    IF @WorkspaceId IS NULL THROW 50017,N'An active workspace is required.',1;
    INSERT cacsms.OpportunityScoringAutonomySettings(WorkspaceId,Enabled,RunIntervalSeconds,AlgorithmVersion,AutoPromoteThreshold,AutoPrioritizeThreshold,MaxCandidatesPerRun,NextRunAt)
    VALUES(@WorkspaceId,1,30,N'adaptive-opportunity-ensemble-v4',85,70,100,SYSUTCDATETIME());

    UPDATE cacsms.IntelligenceItems
    SET State=N'Autonomous enrichment',UpdatedAt=SYSUTCDATETIME()
    WHERE WorkspaceId=@WorkspaceId AND EngineSlug=N'scoring-engine' AND State IN(N'Review',N'Validate');

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'017',N'Autonomous opportunity scoring',HASHBYTES('SHA2_256',N'017:Autonomous opportunity scoring:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
