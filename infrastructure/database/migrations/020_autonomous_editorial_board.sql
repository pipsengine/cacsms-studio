SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'020')
  BEGIN
    CREATE TABLE cacsms.EditorialAutonomySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_EditorialAutonomySettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_EditorialAutonomySettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_EditorialAutonomySettings_Interval DEFAULT 30,
      AlgorithmVersion nvarchar(100) NOT NULL CONSTRAINT DF_EditorialAutonomySettings_Algorithm DEFAULT N'evidence-editorial-orchestrator-v5',
      CurateThreshold decimal(5,2) NOT NULL CONSTRAINT DF_EditorialAutonomySettings_Curate DEFAULT 60,
      VerifyThreshold decimal(5,2) NOT NULL CONSTRAINT DF_EditorialAutonomySettings_Verify DEFAULT 72,
      ApproveThreshold decimal(5,2) NOT NULL CONSTRAINT DF_EditorialAutonomySettings_Approve DEFAULT 84,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_EditorialAutonomySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_EditorialAutonomySettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_EditorialAutonomySettings_Interval CHECK(RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_EditorialAutonomySettings_Thresholds CHECK(CurateThreshold BETWEEN 40 AND VerifyThreshold AND VerifyThreshold <= ApproveThreshold AND ApproveThreshold <= 100)
    );

    CREATE TABLE cacsms.EditorialAutonomyRuns (
      EditorialAutonomyRunId uniqueidentifier NOT NULL CONSTRAINT PK_EditorialAutonomyRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      CandidatesScanned int NOT NULL CONSTRAINT DF_EditorialAutonomyRuns_Scanned DEFAULT 0,
      RecordsIngested int NOT NULL CONSTRAINT DF_EditorialAutonomyRuns_Ingested DEFAULT 0,
      RecordsUpdated int NOT NULL CONSTRAINT DF_EditorialAutonomyRuns_Updated DEFAULT 0,
      RecordsVerified int NOT NULL CONSTRAINT DF_EditorialAutonomyRuns_Verified DEFAULT 0,
      RecordsApproved int NOT NULL CONSTRAINT DF_EditorialAutonomyRuns_Approved DEFAULT 0,
      RecordsHeld int NOT NULL CONSTRAINT DF_EditorialAutonomyRuns_Held DEFAULT 0,
      DuplicatesSuppressed int NOT NULL CONSTRAINT DF_EditorialAutonomyRuns_Duplicates DEFAULT 0,
      EditorialHealth decimal(5,2) NOT NULL CONSTRAINT DF_EditorialAutonomyRuns_Health DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_EditorialAutonomyRuns_Confidence DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_EditorialAutonomyRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_EditorialAutonomyRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_EditorialAutonomyRuns_Status CHECK(Status IN(N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_EditorialAutonomyRuns_Workspace_Started ON cacsms.EditorialAutonomyRuns(WorkspaceId,StartedAt DESC);

    CREATE TABLE cacsms.EditorialAutonomyDecisions (
      EditorialAutonomyDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_EditorialAutonomyDecisions PRIMARY KEY,
      EditorialAutonomyRunId uniqueidentifier NOT NULL,
      RecordId uniqueidentifier NULL,
      OpportunityId uniqueidentifier NULL,
      Action nvarchar(60) NOT NULL,
      EditorialScore decimal(5,2) NOT NULL,
      EvidenceScore decimal(5,2) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_EditorialAutonomyDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_EditorialAutonomyDecisions_Run FOREIGN KEY(EditorialAutonomyRunId) REFERENCES cacsms.EditorialAutonomyRuns(EditorialAutonomyRunId),
      CONSTRAINT FK_EditorialAutonomyDecisions_Record FOREIGN KEY(RecordId) REFERENCES cacsms.OpportunityOperationalRecords(RecordId),
      CONSTRAINT FK_EditorialAutonomyDecisions_Opportunity FOREIGN KEY(OpportunityId) REFERENCES cacsms.Opportunities(OpportunityId),
      CONSTRAINT CK_EditorialAutonomyDecisions_Scores CHECK(EditorialScore BETWEEN 0 AND 100 AND EvidenceScore BETWEEN 0 AND 100 AND Confidence BETWEEN 0 AND 100),
      CONSTRAINT CK_EditorialAutonomyDecisions_Rationale CHECK(ISJSON(RationaleJson)=1)
    );
    CREATE INDEX IX_EditorialAutonomyDecisions_Run ON cacsms.EditorialAutonomyDecisions(EditorialAutonomyRunId,CreatedAt DESC);

    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.EditorialAutonomySettings TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.EditorialAutonomyRuns TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.EditorialAutonomyDecisions TO [$(ApplicationUser)];

    DECLARE @WorkspaceId uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    IF @WorkspaceId IS NULL THROW 50020,N'An active workspace is required.',1;
    INSERT cacsms.EditorialAutonomySettings(WorkspaceId,Enabled,RunIntervalSeconds,AlgorithmVersion,CurateThreshold,VerifyThreshold,ApproveThreshold,NextRunAt)
    VALUES(@WorkspaceId,1,30,N'evidence-editorial-orchestrator-v5',60,72,84,SYSUTCDATETIME());

    UPDATE cacsms.OpportunityOperationalRecords
      SET Status=N'Auto-curated',OwnerName=N'Editorial Autonomy Engine',UpdatedAt=SYSUTCDATETIME()
    WHERE WorkspaceId=@WorkspaceId AND PageSlug=N'editorial-board'
      AND Status IN(N'New Pitch',N'Under Review',N'Fact Check & Validation',N'Approved for Production');

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'020',N'Autonomous editorial board',HASHBYTES('SHA2_256',N'020:Autonomous editorial board:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
