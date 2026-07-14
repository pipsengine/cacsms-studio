SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.SchemaMigrations (
      Version nvarchar(50) NOT NULL CONSTRAINT PK_SchemaMigrations PRIMARY KEY,
      Name nvarchar(200) NOT NULL,
      Checksum varbinary(32) NOT NULL,
      AppliedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT SYSUTCDATETIME()
    );
  END;

  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version = N'001')
  BEGIN
    IF SCHEMA_ID(N'cacsms') IS NULL
      EXEC(N'CREATE SCHEMA cacsms AUTHORIZATION dbo;');

    CREATE TABLE cacsms.Workspaces (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_Workspaces PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      Code nvarchar(50) NOT NULL,
      Name nvarchar(200) NOT NULL,
      Status nvarchar(30) NOT NULL CONSTRAINT DF_Workspaces_Status DEFAULT N'active',
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_Workspaces_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_Workspaces_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT UQ_Workspaces_Code UNIQUE (Code),
      CONSTRAINT CK_Workspaces_Status CHECK (Status IN (N'active', N'inactive', N'archived'))
    );

    CREATE TABLE cacsms.Brands (
      BrandId uniqueidentifier NOT NULL CONSTRAINT PK_Brands PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      Name nvarchar(200) NOT NULL,
      Slug nvarchar(120) NOT NULL,
      IsActive bit NOT NULL CONSTRAINT DF_Brands_IsActive DEFAULT 1,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_Brands_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_Brands_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_Brands_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT UQ_Brands_Workspace_Slug UNIQUE (WorkspaceId, Slug)
    );

    CREATE TABLE cacsms.Users (
      UserId uniqueidentifier NOT NULL CONSTRAINT PK_Users PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      Email nvarchar(320) NOT NULL,
      DisplayName nvarchar(200) NOT NULL,
      Role nvarchar(50) NOT NULL CONSTRAINT DF_Users_Role DEFAULT N'member',
      IsActive bit NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_Users_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT UQ_Users_Workspace_Email UNIQUE (WorkspaceId, Email),
      CONSTRAINT CK_Users_Role CHECK (Role IN (N'administrator', N'manager', N'editor', N'reviewer', N'member', N'viewer'))
    );

    CREATE TABLE cacsms.Productions (
      ProductionId uniqueidentifier NOT NULL CONSTRAINT PK_Productions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      BrandId uniqueidentifier NULL,
      OwnerId uniqueidentifier NULL,
      Code nvarchar(50) NOT NULL,
      Title nvarchar(300) NOT NULL,
      ProductionType nvarchar(100) NOT NULL,
      Stage nvarchar(100) NOT NULL CONSTRAINT DF_Productions_Stage DEFAULT N'discover',
      Status nvarchar(30) NOT NULL CONSTRAINT DF_Productions_Status DEFAULT N'draft',
      Priority nvarchar(20) NOT NULL CONSTRAINT DF_Productions_Priority DEFAULT N'medium',
      Progress tinyint NOT NULL CONSTRAINT DF_Productions_Progress DEFAULT 0,
      DueAt datetimeoffset(0) NULL,
      CompletedAt datetimeoffset(0) NULL,
      PublishedAt datetimeoffset(0) NULL,
      MetadataJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_Productions_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_Productions_UpdatedAt DEFAULT SYSUTCDATETIME(),
      RowVersion rowversion NOT NULL,
      CONSTRAINT FK_Productions_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_Productions_Brands FOREIGN KEY (BrandId) REFERENCES cacsms.Brands(BrandId),
      CONSTRAINT FK_Productions_Owners FOREIGN KEY (OwnerId) REFERENCES cacsms.Users(UserId),
      CONSTRAINT UQ_Productions_Workspace_Code UNIQUE (WorkspaceId, Code),
      CONSTRAINT CK_Productions_Status CHECK (Status IN (N'draft', N'queued', N'active', N'blocked', N'in-review', N'approved', N'completed', N'published', N'failed', N'archived')),
      CONSTRAINT CK_Productions_Priority CHECK (Priority IN (N'low', N'medium', N'high', N'critical')),
      CONSTRAINT CK_Productions_Progress CHECK (Progress BETWEEN 0 AND 100),
      CONSTRAINT CK_Productions_MetadataJson CHECK (MetadataJson IS NULL OR ISJSON(MetadataJson) = 1)
    );
    CREATE INDEX IX_Productions_Status_UpdatedAt ON cacsms.Productions(Status, UpdatedAt DESC);
    CREATE INDEX IX_Productions_Stage_DueAt ON cacsms.Productions(Stage, DueAt) INCLUDE (Title, Progress, OwnerId);

    CREATE TABLE cacsms.ProductionStageHistory (
      StageHistoryId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductionStageHistory PRIMARY KEY,
      ProductionId uniqueidentifier NOT NULL,
      Stage nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      Progress tinyint NOT NULL CONSTRAINT DF_ProductionStageHistory_Progress DEFAULT 0,
      EnteredAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionStageHistory_EnteredAt DEFAULT SYSUTCDATETIME(),
      ExitedAt datetimeoffset(0) NULL,
      Message nvarchar(1000) NULL,
      CONSTRAINT FK_ProductionStageHistory_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId) ON DELETE CASCADE,
      CONSTRAINT CK_ProductionStageHistory_Progress CHECK (Progress BETWEEN 0 AND 100)
    );
    CREATE INDEX IX_ProductionStageHistory_Production_EnteredAt ON cacsms.ProductionStageHistory(ProductionId, EnteredAt DESC);

    CREATE TABLE cacsms.RenderingJobs (
      RenderingJobId uniqueidentifier NOT NULL CONSTRAINT PK_RenderingJobs PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ProductionId uniqueidentifier NOT NULL,
      AssetName nvarchar(300) NULL,
      Engine nvarchar(100) NOT NULL,
      Preset nvarchar(100) NULL,
      Status nvarchar(30) NOT NULL CONSTRAINT DF_RenderingJobs_Status DEFAULT N'queued',
      Progress tinyint NOT NULL CONSTRAINT DF_RenderingJobs_Progress DEFAULT 0,
      AttemptCount int NOT NULL CONSTRAINT DF_RenderingJobs_AttemptCount DEFAULT 0,
      QueuedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_RenderingJobs_QueuedAt DEFAULT SYSUTCDATETIME(),
      StartedAt datetimeoffset(0) NULL,
      CompletedAt datetimeoffset(0) NULL,
      EstimatedCompletionAt datetimeoffset(0) NULL,
      ErrorMessage nvarchar(2000) NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_RenderingJobs_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_RenderingJobs_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId) ON DELETE CASCADE,
      CONSTRAINT CK_RenderingJobs_Status CHECK (Status IN (N'queued', N'running', N'paused', N'completed', N'failed', N'cancelled')),
      CONSTRAINT CK_RenderingJobs_Progress CHECK (Progress BETWEEN 0 AND 100),
      CONSTRAINT CK_RenderingJobs_AttemptCount CHECK (AttemptCount >= 0)
    );
    CREATE INDEX IX_RenderingJobs_Status_QueuedAt ON cacsms.RenderingJobs(Status, QueuedAt);

    CREATE TABLE cacsms.AgentRuns (
      AgentRunId uniqueidentifier NOT NULL CONSTRAINT PK_AgentRuns PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ProductionId uniqueidentifier NULL,
      AgentName nvarchar(200) NOT NULL,
      AgentRole nvarchar(100) NOT NULL,
      TaskName nvarchar(300) NULL,
      Status nvarchar(30) NOT NULL CONSTRAINT DF_AgentRuns_Status DEFAULT N'queued',
      QueueName nvarchar(100) NULL,
      SuccessRate decimal(5,2) NULL,
      CostAmount decimal(18,4) NOT NULL CONSTRAINT DF_AgentRuns_CostAmount DEFAULT 0,
      StartedAt datetimeoffset(0) NULL,
      CompletedAt datetimeoffset(0) NULL,
      LastHeartbeatAt datetimeoffset(0) NULL,
      ErrorMessage nvarchar(2000) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_AgentRuns_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_AgentRuns_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_AgentRuns_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId) ON DELETE SET NULL,
      CONSTRAINT CK_AgentRuns_Status CHECK (Status IN (N'queued', N'running', N'paused', N'completed', N'failed', N'cancelled', N'offline')),
      CONSTRAINT CK_AgentRuns_SuccessRate CHECK (SuccessRate IS NULL OR SuccessRate BETWEEN 0 AND 100),
      CONSTRAINT CK_AgentRuns_CostAmount CHECK (CostAmount >= 0)
    );
    CREATE INDEX IX_AgentRuns_Status_Heartbeat ON cacsms.AgentRuns(Status, LastHeartbeatAt DESC);

    CREATE TABLE cacsms.PublishingJobs (
      PublishingJobId uniqueidentifier NOT NULL CONSTRAINT PK_PublishingJobs PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      ProductionId uniqueidentifier NOT NULL,
      Channel nvarchar(100) NOT NULL,
      AccountName nvarchar(200) NULL,
      Status nvarchar(30) NOT NULL CONSTRAINT DF_PublishingJobs_Status DEFAULT N'queued',
      AttemptCount int NOT NULL CONSTRAINT DF_PublishingJobs_AttemptCount DEFAULT 0,
      ScheduledAt datetimeoffset(0) NULL,
      PublishedAt datetimeoffset(0) NULL,
      ExternalId nvarchar(300) NULL,
      ErrorMessage nvarchar(2000) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_PublishingJobs_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_PublishingJobs_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_PublishingJobs_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId) ON DELETE CASCADE,
      CONSTRAINT CK_PublishingJobs_Status CHECK (Status IN (N'queued', N'scheduled', N'ready', N'publishing', N'published', N'failed', N'cancelled')),
      CONSTRAINT CK_PublishingJobs_AttemptCount CHECK (AttemptCount >= 0)
    );
    CREATE INDEX IX_PublishingJobs_Status_ScheduledAt ON cacsms.PublishingJobs(Status, ScheduledAt);

    CREATE TABLE cacsms.CalendarEvents (
      CalendarEventId uniqueidentifier NOT NULL CONSTRAINT PK_CalendarEvents PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      ProductionId uniqueidentifier NULL,
      OwnerId uniqueidentifier NULL,
      Title nvarchar(300) NOT NULL,
      EventType nvarchar(60) NOT NULL,
      Status nvarchar(30) NOT NULL CONSTRAINT DF_CalendarEvents_Status DEFAULT N'scheduled',
      StartsAt datetimeoffset(0) NOT NULL,
      EndsAt datetimeoffset(0) NULL,
      IsAllDay bit NOT NULL CONSTRAINT DF_CalendarEvents_IsAllDay DEFAULT 0,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_CalendarEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_CalendarEvents_UpdatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_CalendarEvents_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_CalendarEvents_Productions FOREIGN KEY (ProductionId) REFERENCES cacsms.Productions(ProductionId) ON DELETE SET NULL,
      CONSTRAINT FK_CalendarEvents_Owners FOREIGN KEY (OwnerId) REFERENCES cacsms.Users(UserId),
      CONSTRAINT CK_CalendarEvents_Status CHECK (Status IN (N'scheduled', N'in-progress', N'completed', N'cancelled')),
      CONSTRAINT CK_CalendarEvents_TimeRange CHECK (EndsAt IS NULL OR EndsAt >= StartsAt)
    );
    CREATE INDEX IX_CalendarEvents_Workspace_StartsAt ON cacsms.CalendarEvents(WorkspaceId, StartsAt);

    CREATE TABLE cacsms.Notifications (
      NotificationId uniqueidentifier NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      UserId uniqueidentifier NULL,
      Title nvarchar(300) NOT NULL,
      Body nvarchar(2000) NULL,
      Category nvarchar(80) NOT NULL,
      Severity nvarchar(20) NOT NULL CONSTRAINT DF_Notifications_Severity DEFAULT N'info',
      EntityType nvarchar(100) NULL,
      EntityId nvarchar(100) NULL,
      IsRead bit NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT 0,
      ReadAt datetimeoffset(0) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_Notifications_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserId) REFERENCES cacsms.Users(UserId),
      CONSTRAINT CK_Notifications_Severity CHECK (Severity IN (N'info', N'success', N'warning', N'critical'))
    );
    CREATE INDEX IX_Notifications_User_Read_CreatedAt ON cacsms.Notifications(UserId, IsRead, CreatedAt DESC);

    CREATE TABLE cacsms.ServiceHealthChecks (
      ServiceHealthCheckId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ServiceHealthChecks PRIMARY KEY,
      ServiceName nvarchar(200) NOT NULL,
      Category nvarchar(100) NOT NULL,
      Status nvarchar(30) NOT NULL,
      LatencyMs int NULL,
      Message nvarchar(1000) NULL,
      CheckedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ServiceHealthChecks_CheckedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_ServiceHealthChecks_Status CHECK (Status IN (N'healthy', N'degraded', N'offline')),
      CONSTRAINT CK_ServiceHealthChecks_Latency CHECK (LatencyMs IS NULL OR LatencyMs >= 0)
    );
    CREATE INDEX IX_ServiceHealthChecks_Service_CheckedAt ON cacsms.ServiceHealthChecks(ServiceName, CheckedAt DESC);

    CREATE TABLE cacsms.AuditEvents (
      AuditEventId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditEvents PRIMARY KEY,
      WorkspaceId uniqueidentifier NULL,
      ActorId uniqueidentifier NULL,
      EventType nvarchar(150) NOT NULL,
      EntityType nvarchar(100) NULL,
      EntityId nvarchar(100) NULL,
      CorrelationId uniqueidentifier NULL,
      PayloadJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_AuditEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_AuditEvents_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_AuditEvents_Users FOREIGN KEY (ActorId) REFERENCES cacsms.Users(UserId),
      CONSTRAINT CK_AuditEvents_PayloadJson CHECK (PayloadJson IS NULL OR ISJSON(PayloadJson) = 1)
    );
    CREATE INDEX IX_AuditEvents_Workspace_CreatedAt ON cacsms.AuditEvents(WorkspaceId, CreatedAt DESC);
    CREATE INDEX IX_AuditEvents_CorrelationId ON cacsms.AuditEvents(CorrelationId) WHERE CorrelationId IS NOT NULL;

    IF DATABASE_PRINCIPAL_ID(N'cacsms_app') IS NULL
      CREATE ROLE cacsms_app AUTHORIZATION dbo;

    IF DATABASE_PRINCIPAL_ID(N'$(ApplicationUser)') IS NULL
      THROW 50001, 'The configured application database user does not exist.', 1;

    GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::cacsms TO cacsms_app;
    GRANT EXECUTE ON SCHEMA::cacsms TO cacsms_app;
    DENY ALTER ON SCHEMA::cacsms TO cacsms_app;

    IF ISNULL(IS_ROLEMEMBER(N'cacsms_app', N'$(ApplicationUser)'), 0) <> 1
      ALTER ROLE cacsms_app ADD MEMBER [$(ApplicationUser)];

    INSERT dbo.SchemaMigrations (Version, Name, Checksum)
    VALUES (N'001', N'CACSMS operational baseline', HASHBYTES('SHA2_256', N'001:CACSMS operational baseline'));
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
