SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'026')
  BEGIN
    CREATE TABLE cacsms.StoryStructureAutonomySettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_StoryStructureAutonomySettings PRIMARY KEY,
      Enabled bit NOT NULL CONSTRAINT DF_StoryStructureAutonomySettings_Enabled DEFAULT 1,
      RunIntervalSeconds int NOT NULL CONSTRAINT DF_StoryStructureAutonomySettings_Interval DEFAULT 30,
      AlgorithmVersion nvarchar(100) NOT NULL CONSTRAINT DF_StoryStructureAutonomySettings_Algorithm DEFAULT N'dual-path-structure-intelligence-v6',
      ApprovalThreshold decimal(5,2) NOT NULL CONSTRAINT DF_StoryStructureAutonomySettings_Approval DEFAULT 86,
      MaximumRisk decimal(5,2) NOT NULL CONSTRAINT DF_StoryStructureAutonomySettings_Risk DEFAULT 30,
      LastRunAt datetimeoffset(0) NULL,
      NextRunAt datetimeoffset(0) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_StoryStructureAutonomySettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_StoryStructureAutonomySettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_StoryStructureAutonomySettings_Interval CHECK(RunIntervalSeconds BETWEEN 30 AND 86400),
      CONSTRAINT CK_StoryStructureAutonomySettings_Gates CHECK(ApprovalThreshold BETWEEN 50 AND 100 AND MaximumRisk BETWEEN 0 AND 60)
    );

    CREATE TABLE cacsms.StoryStructures (
      StoryStructureId uniqueidentifier NOT NULL CONSTRAINT PK_StoryStructures PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      ProductionId uniqueidentifier NOT NULL,
      StructureMode nvarchar(30) NOT NULL,
      Title nvarchar(300) NOT NULL,
      Objective nvarchar(500) NOT NULL,
      Audience nvarchar(200) NOT NULL,
      Framework nvarchar(120) NOT NULL,
      Status nvarchar(60) NOT NULL,
      CoherenceScore decimal(5,2) NOT NULL,
      PedagogyScore decimal(5,2) NOT NULL,
      EngagementScore decimal(5,2) NOT NULL,
      KnowledgeAlignment decimal(5,2) NOT NULL,
      RiskScore decimal(5,2) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      Progress tinyint NOT NULL,
      BlueprintJson nvarchar(max) NOT NULL,
      AgentTeamJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_StoryStructures_Created DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_StoryStructures_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_StoryStructures_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_StoryStructures_Production FOREIGN KEY(ProductionId) REFERENCES cacsms.Productions(ProductionId),
      CONSTRAINT UQ_StoryStructures_Production UNIQUE(ProductionId),
      CONSTRAINT CK_StoryStructures_Mode CHECK(StructureMode IN(N'narrative',N'learning',N'hybrid')),
      CONSTRAINT CK_StoryStructures_Progress CHECK(Progress BETWEEN 0 AND 100),
      CONSTRAINT CK_StoryStructures_Blueprint CHECK(ISJSON(BlueprintJson)=1),
      CONSTRAINT CK_StoryStructures_Agents CHECK(ISJSON(AgentTeamJson)=1)
    );
    CREATE INDEX IX_StoryStructures_Workspace_Status ON cacsms.StoryStructures(WorkspaceId,Status,UpdatedAt DESC);

    CREATE TABLE cacsms.StoryStructureAutonomyRuns (
      StoryStructureAutonomyRunId uniqueidentifier NOT NULL CONSTRAINT PK_StoryStructureAutonomyRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      TriggerSource nvarchar(40) NOT NULL,
      AlgorithmVersion nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      ProductionsScanned int NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Scanned DEFAULT 0,
      StructuresGenerated int NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Generated DEFAULT 0,
      StructuresUpdated int NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Updated DEFAULT 0,
      StructuresApproved int NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Approved DEFAULT 0,
      StructuresRefining int NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Refining DEFAULT 0,
      StructuresHeld int NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Held DEFAULT 0,
      NarrativeCount int NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Narrative DEFAULT 0,
      LearningCount int NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Learning DEFAULT 0,
      HybridCount int NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Hybrid DEFAULT 0,
      AverageStructureQuality decimal(5,2) NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Quality DEFAULT 0,
      AverageConfidence decimal(5,2) NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Confidence DEFAULT 0,
      ErrorMessage nvarchar(1000) NULL,
      StartedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_StoryStructureAutonomyRuns_Started DEFAULT SYSUTCDATETIME(),
      CompletedAt datetimeoffset(0) NULL,
      CONSTRAINT FK_StoryStructureAutonomyRuns_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_StoryStructureAutonomyRuns_Status CHECK(Status IN(N'running',N'completed',N'failed',N'skipped'))
    );
    CREATE INDEX IX_StoryStructureAutonomyRuns_Workspace_Started ON cacsms.StoryStructureAutonomyRuns(WorkspaceId,StartedAt DESC);

    CREATE TABLE cacsms.StoryStructureAutonomyDecisions (
      StoryStructureAutonomyDecisionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_StoryStructureAutonomyDecisions PRIMARY KEY,
      StoryStructureAutonomyRunId uniqueidentifier NOT NULL,
      StoryStructureId uniqueidentifier NOT NULL,
      ProductionId uniqueidentifier NOT NULL,
      Action nvarchar(60) NOT NULL,
      StructureMode nvarchar(30) NOT NULL,
      StructureQuality decimal(5,2) NOT NULL,
      RiskScore decimal(5,2) NOT NULL,
      Confidence decimal(5,2) NOT NULL,
      Framework nvarchar(120) NOT NULL,
      RationaleJson nvarchar(max) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_StoryStructureAutonomyDecisions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_StoryStructureAutonomyDecisions_Run FOREIGN KEY(StoryStructureAutonomyRunId) REFERENCES cacsms.StoryStructureAutonomyRuns(StoryStructureAutonomyRunId),
      CONSTRAINT FK_StoryStructureAutonomyDecisions_Structure FOREIGN KEY(StoryStructureId) REFERENCES cacsms.StoryStructures(StoryStructureId),
      CONSTRAINT FK_StoryStructureAutonomyDecisions_Production FOREIGN KEY(ProductionId) REFERENCES cacsms.Productions(ProductionId),
      CONSTRAINT CK_StoryStructureAutonomyDecisions_Rationale CHECK(ISJSON(RationaleJson)=1)
    );
    CREATE INDEX IX_StoryStructureAutonomyDecisions_Run ON cacsms.StoryStructureAutonomyDecisions(StoryStructureAutonomyRunId,CreatedAt DESC);

    INSERT cacsms.StoryStructureAutonomySettings(WorkspaceId) SELECT WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active';
    IF EXISTS(SELECT 1 FROM sys.database_principals WHERE name=N'CACSMS_ApplicationUser')
    BEGIN
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.StoryStructureAutonomySettings TO CACSMS_ApplicationUser;
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.StoryStructures TO CACSMS_ApplicationUser;
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.StoryStructureAutonomyRuns TO CACSMS_ApplicationUser;
      GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.StoryStructureAutonomyDecisions TO CACSMS_ApplicationUser;
    END;
    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
      VALUES(N'026',N'Autonomous story and learning structure engine',HASHBYTES('SHA2_256',N'026:Autonomous story and learning structure engine:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
