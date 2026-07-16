SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'015')
  BEGIN
    INSERT cacsms.KnowledgeAuditHistory(WorkspaceId,KnowledgeRecordId,Action,AfterJson)
    SELECT WorkspaceId,KnowledgeRecordId,N'autonomous-takeover',N'{"status":"processing","humanInputRequired":false}'
    FROM cacsms.KnowledgeRecords WHERE Status IN(N'review',N'draft') AND ArchivedAt IS NULL;

    UPDATE cacsms.KnowledgeRecords
    SET Status=N'processing',UpdatedAt=SYSUTCDATETIME()
    WHERE Status IN(N'review',N'draft') AND ArchivedAt IS NULL;

    UPDATE cacsms.KnowledgeAutonomySettings
    SET Enabled=1,NextRunAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME();

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'015',N'Zero-input knowledge autonomy',HASHBYTES('SHA2_256',N'015:Zero-input knowledge autonomy:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
