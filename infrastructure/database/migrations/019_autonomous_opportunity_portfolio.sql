SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'019')
  BEGIN
    CREATE TABLE cacsms.OpportunityPortfolioAutonomySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_OpportunityPortfolioAutonomySettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomySettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomySettings_Interval DEFAULT 30,
      AlgorithmVersion nvarchar(100) NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomySettings_Algorithm DEFAULT N'adaptive-portfolio-orchestrator-v4',
      PromoteThreshold decimal(5,2) NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomySettings_Promote DEFAULT 85,
      PrioritizeThreshold decimal(5,2) NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomySettings_Prioritize DEFAULT 70,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_OpportunityPortfolioAutonomySettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_OpportunityPortfolioAutonomySettings_Interval CHECK(RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_OpportunityPortfolioAutonomySettings_Thresholds CHECK(PromoteThreshold BETWEEN 70 AND 100 AND PrioritizeThreshold BETWEEN 40 AND PromoteThreshold)
    );

    CREATE TABLE cacsms.OpportunityPortfolioAutonomyRuns (
      OpportunityPortfolioRunId uniqueidentifier NOT NULL CONSTRAINT PK_OpportunityPortfolioAutonomyRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      CandidatesScanned int NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomyRuns_Scanned DEFAULT 0,
      RecordsIngested int NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomyRuns_Ingested DEFAULT 0,
      RecordsUpdated int NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomyRuns_Updated DEFAULT 0,
      RecordsPromoted int NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomyRuns_Promoted DEFAULT 0,
      RecordsEnriching int NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomyRuns_Enriching DEFAULT 0,
      DuplicatesSuppressed int NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomyRuns_Duplicates DEFAULT 0,
      PortfolioScore decimal(5,2) NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomyRuns_Score DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomyRuns_Confidence DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomyRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_OpportunityPortfolioAutonomyRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_OpportunityPortfolioAutonomyRuns_Status CHECK(Status IN(N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_OpportunityPortfolioAutonomyRuns_Workspace_Started ON cacsms.OpportunityPortfolioAutonomyRuns(WorkspaceId,StartedAt DESC);

    CREATE TABLE cacsms.OpportunityPortfolioAutonomyDecisions (
      OpportunityPortfolioDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_OpportunityPortfolioAutonomyDecisions PRIMARY KEY,
      OpportunityPortfolioRunId uniqueidentifier NOT NULL,
      OpportunityId uniqueidentifier NULL,
      Action nvarchar(60) NOT NULL,
      Score decimal(5,2) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunityPortfolioAutonomyDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_OpportunityPortfolioAutonomyDecisions_Run FOREIGN KEY(OpportunityPortfolioRunId) REFERENCES cacsms.OpportunityPortfolioAutonomyRuns(OpportunityPortfolioRunId),
      CONSTRAINT FK_OpportunityPortfolioAutonomyDecisions_Opportunity FOREIGN KEY(OpportunityId) REFERENCES cacsms.Opportunities(OpportunityId),
      CONSTRAINT CK_OpportunityPortfolioAutonomyDecisions_Score CHECK(Score BETWEEN 0 AND 100),
      CONSTRAINT CK_OpportunityPortfolioAutonomyDecisions_Confidence CHECK(Confidence BETWEEN 0 AND 100),
      CONSTRAINT CK_OpportunityPortfolioAutonomyDecisions_Rationale CHECK(ISJSON(RationaleJson)=1)
    );
    CREATE INDEX IX_OpportunityPortfolioAutonomyDecisions_Run ON cacsms.OpportunityPortfolioAutonomyDecisions(OpportunityPortfolioRunId,CreatedAt DESC);

    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.OpportunityPortfolioAutonomySettings TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.OpportunityPortfolioAutonomyRuns TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.OpportunityPortfolioAutonomyDecisions TO [$(ApplicationUser)];

    DECLARE @WorkspaceId uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    IF @WorkspaceId IS NULL THROW 50019,N'An active workspace is required.',1;
    INSERT cacsms.OpportunityPortfolioAutonomySettings(WorkspaceId,Enabled,RunIntervalSeconds,AlgorithmVersion,PromoteThreshold,PrioritizeThreshold,NextRunAt)
    VALUES(@WorkspaceId,1,30,N'adaptive-portfolio-orchestrator-v4',85,70,SYSUTCDATETIME());

    UPDATE cacsms.Opportunities SET Status=N'Autonomous enrichment',OwnerName=N'Portfolio Autonomy Engine',UpdatedAt=SYSUTCDATETIME()
    WHERE WorkspaceId=@WorkspaceId AND IsArchived=0 AND Status IN(N'Ready to validate',N'New',N'Review',N'Validating');

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'019',N'Autonomous opportunity portfolio',HASHBYTES('SHA2_256',N'019:Autonomous opportunity portfolio:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
