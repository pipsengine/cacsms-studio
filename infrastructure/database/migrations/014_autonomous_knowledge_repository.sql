SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'014')
  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.KnowledgeDomains TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.KnowledgeRecords TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.KnowledgeLinks TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.KnowledgeAuditHistory TO [$(ApplicationUser)];

    CREATE TABLE cacsms.KnowledgeAutonomySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_KnowledgeAutonomySettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_KnowledgeAutonomySettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_KnowledgeAutonomySettings_Interval DEFAULT 60,
      AutoVerifyThreshold decimal(5,2) NOT NULL CONSTRAINT DF_KnowledgeAutonomySettings_Verify DEFAULT 88,
      AutoLinkThreshold decimal(5,2) NOT NULL CONSTRAINT DF_KnowledgeAutonomySettings_Link DEFAULT 72,
      ReviewThreshold decimal(5,2) NOT NULL CONSTRAINT DF_KnowledgeAutonomySettings_Review DEFAULT 62,
      MaxRecordsPerRun int NOT NULL CONSTRAINT DF_KnowledgeAutonomySettings_Max DEFAULT 50,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeAutonomySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_KnowledgeAutonomySettings_Workspace FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_KnowledgeAutonomySettings_Interval CHECK (RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_KnowledgeAutonomySettings_Thresholds CHECK (AutoVerifyThreshold BETWEEN 70 AND 100 AND AutoLinkThreshold BETWEEN 50 AND 100 AND ReviewThreshold BETWEEN 0 AND 90),
      CONSTRAINT CK_KnowledgeAutonomySettings_Max CHECK (MaxRecordsPerRun BETWEEN 1 AND 500)
    );

    CREATE TABLE cacsms.KnowledgeAutonomyRuns (
      KnowledgeAutonomyRunId uniqueidentifier NOT NULL CONSTRAINT PK_KnowledgeAutonomyRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(80) NOT NULL,
      Status nvarchar(30) NOT NULL,
      CandidatesScanned int NOT NULL CONSTRAINT DF_KnowledgeAutonomyRuns_Scanned DEFAULT 0,
      RecordsCreated int NOT NULL CONSTRAINT DF_KnowledgeAutonomyRuns_Created DEFAULT 0,
      RecordsUpdated int NOT NULL CONSTRAINT DF_KnowledgeAutonomyRuns_Updated DEFAULT 0,
      RecordsVerified int NOT NULL CONSTRAINT DF_KnowledgeAutonomyRuns_Verified DEFAULT 0,
      RecordsFlagged int NOT NULL CONSTRAINT DF_KnowledgeAutonomyRuns_Flagged DEFAULT 0,
      LinksCreated int NOT NULL CONSTRAINT DF_KnowledgeAutonomyRuns_Links DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_KnowledgeAutonomyRuns_Confidence DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeAutonomyRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_KnowledgeAutonomyRuns_Workspace FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_KnowledgeAutonomyRuns_Status CHECK (Status IN (N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_KnowledgeAutonomyRuns_Workspace_Started ON cacsms.KnowledgeAutonomyRuns(WorkspaceId,StartedAt DESC);

    CREATE TABLE cacsms.KnowledgeAutonomyDecisions (
      KnowledgeAutonomyDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_KnowledgeAutonomyDecisions PRIMARY KEY,
      KnowledgeAutonomyRunId uniqueidentifier NOT NULL,
      KnowledgeRecordId uniqueidentifier NULL,
      DecisionType nvarchar(40) NOT NULL,
      Action nvarchar(60) NOT NULL,
      Score decimal(5,2) NOT NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeAutonomyDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_KnowledgeAutonomyDecisions_Run FOREIGN KEY (KnowledgeAutonomyRunId) REFERENCES cacsms.KnowledgeAutonomyRuns(KnowledgeAutonomyRunId),
      CONSTRAINT FK_KnowledgeAutonomyDecisions_Record FOREIGN KEY (KnowledgeRecordId) REFERENCES cacsms.KnowledgeRecords(KnowledgeRecordId),
      CONSTRAINT CK_KnowledgeAutonomyDecisions_Score CHECK (Score BETWEEN 0 AND 100),
      CONSTRAINT CK_KnowledgeAutonomyDecisions_Rationale CHECK (ISJSON(RationaleJson)=1)
    );
    CREATE INDEX IX_KnowledgeAutonomyDecisions_Run ON cacsms.KnowledgeAutonomyDecisions(KnowledgeAutonomyRunId,CreatedAt DESC);

    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.KnowledgeAutonomySettings TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.KnowledgeAutonomyRuns TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.KnowledgeAutonomyDecisions TO [$(ApplicationUser)];

    DECLARE @WorkspaceId uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    INSERT cacsms.KnowledgeAutonomySettings(WorkspaceId,Enabled,RunIntervalSeconds,AutoVerifyThreshold,AutoLinkThreshold,ReviewThreshold,MaxRecordsPerRun,NextRunAt)
    VALUES(@WorkspaceId,1,60,88,72,62,50,SYSUTCDATETIME());

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'014',N'Autonomous knowledge repository',HASHBYTES('SHA2_256',N'014:Autonomous knowledge repository:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
