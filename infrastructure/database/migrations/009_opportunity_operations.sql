SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version = N'009')
  BEGIN
    CREATE TABLE cacsms.OpportunityOperationalRecords (
      RecordId uniqueidentifier NOT NULL CONSTRAINT PK_OpportunityOperationalRecords PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
      WorkspaceId uniqueidentifier NOT NULL,
      PageSlug nvarchar(80) NOT NULL,
      RecordType nvarchar(80) NOT NULL,
      Title nvarchar(300) NOT NULL,
      Description nvarchar(1000) NULL,
      Category nvarchar(120) NULL,
      Status nvarchar(60) NOT NULL,
      OwnerName nvarchar(150) NULL,
      Score tinyint NULL,
      Progress tinyint NULL,
      Amount decimal(18,2) NULL,
      StartAt datetimeoffset(0) NULL,
      DueAt datetimeoffset(0) NULL,
      MetadataJson nvarchar(max) NULL,
      CreatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunityOperationalRecords_Created DEFAULT SYSUTCDATETIME(),
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunityOperationalRecords_Updated DEFAULT SYSUTCDATETIME(),
      RowVersion rowversion NOT NULL,
      CONSTRAINT FK_OpportunityOperationalRecords_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_OpportunityOperationalRecords_Score CHECK (Score IS NULL OR Score BETWEEN 0 AND 100),
      CONSTRAINT CK_OpportunityOperationalRecords_Progress CHECK (Progress IS NULL OR Progress BETWEEN 0 AND 100),
      CONSTRAINT CK_OpportunityOperationalRecords_Metadata CHECK (MetadataJson IS NULL OR ISJSON(MetadataJson)=1)
    );
    CREATE INDEX IX_OpportunityOperationalRecords_Page ON cacsms.OpportunityOperationalRecords(WorkspaceId, PageSlug, UpdatedAt DESC);
    CREATE INDEX IX_OpportunityOperationalRecords_Status ON cacsms.OpportunityOperationalRecords(WorkspaceId, PageSlug, Status, DueAt);

    CREATE TABLE cacsms.OpportunityOperationalSettings (
      WorkspaceId uniqueidentifier NOT NULL,
      PageSlug nvarchar(80) NOT NULL,
      SettingKey nvarchar(120) NOT NULL,
      ValueJson nvarchar(max) NOT NULL,
      UpdatedAt datetimeoffset(0) NOT NULL CONSTRAINT DF_OpportunityOperationalSettings_Updated DEFAULT SYSUTCDATETIME(),
      UpdatedBy nvarchar(150) NULL,
      RowVersion rowversion NOT NULL,
      CONSTRAINT PK_OpportunityOperationalSettings PRIMARY KEY (WorkspaceId, PageSlug, SettingKey),
      CONSTRAINT FK_OpportunityOperationalSettings_Workspaces FOREIGN KEY (WorkspaceId) REFERENCES cacsms.Workspaces(WorkspaceId),
      CONSTRAINT CK_OpportunityOperationalSettings_Value CHECK (ISJSON(ValueJson)=1)
    );

    INSERT dbo.SchemaMigrations (Version, Name, Checksum)
    VALUES (N'009', N'Opportunity operational pages', HASHBYTES('SHA2_256', N'009:Opportunity operational pages'));
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
