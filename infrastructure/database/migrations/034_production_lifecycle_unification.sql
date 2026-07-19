SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'034')
  BEGIN
    CREATE TABLE cacsms.ProductionLifecycleSettings (
      WorkspaceId uniqueidentifier NOT NULL CONSTRAINT PK_ProductionLifecycleSettings PRIMARY KEY,
      AutoAdvanceEnabled bit NOT NULL CONSTRAINT DF_ProductionLifecycleSettings_AutoAdvance DEFAULT 1,
      ManualApprovalRequired bit NOT NULL CONSTRAINT DF_ProductionLifecycleSettings_ManualApproval DEFAULT 0,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionLifecycleSettings_Updated DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_ProductionLifecycleSettings_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId)
    );

    CREATE TABLE cacsms.ProductionLifecycleStageCompletions (
      StageCompletionId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductionLifecycleStageCompletions PRIMARY KEY,
      WorkspaceId uniqueidentifier NOT NULL,
      LifecycleStage nvarchar(50) NOT NULL,
      EntityType nvarchar(50) NOT NULL,
      EntityId uniqueidentifier NULL,
      Status nvarchar(30) NOT NULL,
      ValidatedChecksJson nvarchar(max) NULL,
      CompletedByUserId uniqueidentifier NULL,
      CompletedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_ProductionLifecycleStageCompletions_Completed DEFAULT SYSUTCDATETIME(),
      Message nvarchar(1000) NULL,
      CONSTRAINT FK_ProductionLifecycleStageCompletions_Workspace FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT FK_ProductionLifecycleStageCompletions_User FOREIGN KEY(CompletedByUserId) REFERENCES cacsms.Users(UserId),
      CONSTRAINT CK_ProductionLifecycleStageCompletions_Stage CHECK(LifecycleStage IN(
        N'discover',N'research',N'evaluate',N'pre-plan',N'schedule',N'produce',N'assemble',
        N'quality',N'export',N'publish',N'monitor',N'learn',N'repeat'
      )),
      CONSTRAINT CK_ProductionLifecycleStageCompletions_Status CHECK(Status IN(N'ready',N'blocked',N'pending')),
      CONSTRAINT CK_ProductionLifecycleStageCompletions_Validated CHECK(ValidatedChecksJson IS NULL OR ISJSON(ValidatedChecksJson)=1)
    );
    CREATE INDEX IX_ProductionLifecycleStageCompletions_Workspace_Stage ON cacsms.ProductionLifecycleStageCompletions(WorkspaceId,LifecycleStage,CompletedAt DESC);

    CREATE TABLE cacsms.UserSessions (
      SessionId uniqueidentifier NOT NULL CONSTRAINT PK_UserSessions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      UserId uniqueidentifier NOT NULL,
      WorkspaceId uniqueidentifier NOT NULL,
      TokenHash nvarchar(128) NOT NULL,
      Role nvarchar(50) NOT NULL,
      ExpiresAt datetimeoffset(0) NOT NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_UserSessions_Created DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_UserSessions_Users FOREIGN KEY(UserId) REFERENCES cacsms.Users(UserId),
      CONSTRAINT FK_UserSessions_Workspaces FOREIGN KEY(WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT UQ_UserSessions_TokenHash UNIQUE(TokenHash),
      CONSTRAINT CK_UserSessions_Role CHECK(Role IN(N'administrator',N'manager',N'editor',N'reviewer',N'member',N'viewer'))
    );
    CREATE INDEX IX_UserSessions_Expires ON cacsms.UserSessions(ExpiresAt);

    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.ProductionLifecycleSettings TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.ProductionLifecycleStageCompletions TO [$(ApplicationUser)];
    GRANT SELECT,INSERT,UPDATE,DELETE ON cacsms.UserSessions TO [$(ApplicationUser)];

    DECLARE @WorkspaceId uniqueidentifier=(SELECT TOP(1) WorkspaceId FROM cacsms.Workspaces WHERE Status=N'active' ORDER BY CreatedAt);
    IF @WorkspaceId IS NOT NULL
      INSERT cacsms.ProductionLifecycleSettings(WorkspaceId,AutoAdvanceEnabled,ManualApprovalRequired)
      VALUES(@WorkspaceId,1,0);

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'034',N'production_lifecycle_unification',HASHBYTES(N'SHA2_256',N'034_production_lifecycle_unification'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
