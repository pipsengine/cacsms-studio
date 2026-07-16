SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'022')
  BEGIN
    ALTER TABLE cacsms.KnowledgeRecords DROP CONSTRAINT CK_KnowledgeRecords_Status;
    ALTER TABLE cacsms.KnowledgeRecords ADD CONSTRAINT CK_KnowledgeRecords_Status
      CHECK(Status IN(N'active',N'verified',N'review',N'processing',N'draft',N'quarantined',N'archived'));

    CREATE TABLE cacsms.KnowledgeQualityAutonomySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_KnowledgeQualityAutonomySettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomySettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomySettings_Interval DEFAULT 30,
      AlgorithmVersion nvarchar(100) NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomySettings_Algorithm DEFAULT N'multidimensional-quality-guardian-v5',
      AutoCertifyThreshold decimal(5,2) NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomySettings_Certify DEFAULT 85,
      AutoRemediateThreshold decimal(5,2) NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomySettings_Remediate DEFAULT 65,
      QuarantineThreshold decimal(5,2) NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomySettings_Quarantine DEFAULT 45,
      DuplicateThreshold decimal(5,2) NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomySettings_Duplicate DEFAULT 92,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_KnowledgeQualityAutonomySettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_KnowledgeQualityAutonomySettings_Interval CHECK(RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_KnowledgeQualityAutonomySettings_Thresholds CHECK(QuarantineThreshold BETWEEN 0 AND AutoRemediateThreshold AND AutoRemediateThreshold <= AutoCertifyThreshold AND AutoCertifyThreshold <= 100 AND DuplicateThreshold BETWEEN 75 AND 100)
    );

    CREATE TABLE cacsms.KnowledgeQualityAutonomyRuns (
      KnowledgeQualityRunId uniqueidentifier NOT NULL CONSTRAINT PK_KnowledgeQualityAutonomyRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      RecordsScanned int NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomyRuns_Scanned DEFAULT 0,
      RecordsCertified int NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomyRuns_Certified DEFAULT 0,
      RecordsRemediated int NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomyRuns_Remediated DEFAULT 0,
      RecordsQuarantined int NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomyRuns_Quarantined DEFAULT 0,
      RecordsMonitored int NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomyRuns_Monitored DEFAULT 0,
      DuplicatesDetected int NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomyRuns_Duplicates DEFAULT 0,
      AnomaliesDetected int NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomyRuns_Anomalies DEFAULT 0,
      AverageQuality decimal(5,2) NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomyRuns_Quality DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomyRuns_Confidence DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomyRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_KnowledgeQualityAutonomyRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_KnowledgeQualityAutonomyRuns_Status CHECK(Status IN(N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_KnowledgeQualityAutonomyRuns_Workspace_Started ON cacsms.KnowledgeQualityAutonomyRuns(WorkspaceId,StartedAt DESC);

    CREATE TABLE cacsms.KnowledgeQualityAutonomyDecisions (
      KnowledgeQualityDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_KnowledgeQualityAutonomyDecisions PRIMARY KEY,
      KnowledgeQualityRunId uniqueidentifier NOT NULL,
      KnowledgeRecordId uniqueidentifier NOT NULL,
      Action nvarchar(60) NOT NULL,
      CompositeScore decimal(5,2) NOT NULL,
      TrustScore decimal(5,2) NOT NULL,
      AccuracyScore decimal(5,2) NOT NULL,
      FreshnessScore decimal(5,2) NOT NULL,
      CompletenessScore decimal(5,2) NOT NULL,
      ConsistencyScore decimal(5,2) NOT NULL,
      RiskScore decimal(5,2) NOT NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_KnowledgeQualityAutonomyDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_KnowledgeQualityAutonomyDecisions_Run FOREIGN KEY(KnowledgeQualityRunId) REFERENCES cacsms.KnowledgeQualityAutonomyRuns(KnowledgeQualityRunId),
      CONSTRAINT FK_KnowledgeQualityAutonomyDecisions_Record FOREIGN KEY(KnowledgeRecordId) REFERENCES cacsms.KnowledgeRecords(KnowledgeRecordId),
      CONSTRAINT CK_KnowledgeQualityAutonomyDecisions_Scores CHECK(CompositeScore BETWEEN 0 AND 100 AND TrustScore BETWEEN 0 AND 100 AND AccuracyScore BETWEEN 0 AND 100 AND FreshnessScore BETWEEN 0 AND 100 AND CompletenessScore BETWEEN 0 AND 100 AND ConsistencyScore BETWEEN 0 AND 100 AND RiskScore BETWEEN 0 AND 100),
      CONSTRAINT CK_KnowledgeQualityAutonomyDecisions_Rationale CHECK(ISJSON(RationaleJson)=1)
    );
    CREATE INDEX IX_KnowledgeQualityAutonomyDecisions_Run ON cacsms.KnowledgeQualityAutonomyDecisions(KnowledgeQualityRunId,CompositeScore DESC);
    CREATE INDEX IX_KnowledgeQualityAutonomyDecisions_Record ON cacsms.KnowledgeQualityAutonomyDecisions(KnowledgeRecordId,CreatedAt DESC);

    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.KnowledgeQualityAutonomySettings TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.KnowledgeQualityAutonomyRuns TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.KnowledgeQualityAutonomyDecisions TO [$(ApplicationUser)];

    DECLARE @WorkspaceId uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    IF @WorkspaceId IS NULL THROW 50022,N'An active workspace is required.',1;
    INSERT cacsms.KnowledgeQualityAutonomySettings(WorkspaceId,Enabled,RunIntervalSeconds,AlgorithmVersion,AutoCertifyThreshold,AutoRemediateThreshold,QuarantineThreshold,DuplicateThreshold,NextRunAt)
    VALUES(@WorkspaceId,1,30,N'multidimensional-quality-guardian-v5',85,65,45,92,SYSUTCDATETIME());

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'022',N'Autonomous knowledge quality',HASHBYTES('SHA2_256',N'022:Autonomous knowledge quality:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
