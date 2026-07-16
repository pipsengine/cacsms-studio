SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'016')
  BEGIN
    UPDATE cacsms.KnowledgeLinks
    SET Status=N'verified',
        Source=N'Autonomous semantic-domain linker',
        UpdatedAt=SYSUTCDATETIME()
    WHERE Status IN(N'review',N'draft');

    UPDATE cacsms.KnowledgeAutonomySettings
    SET Enabled=1,NextRunAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME();

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'016',N'Autonomous link adjudication',HASHBYTES('SHA2_256',N'016:Autonomous link adjudication:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
