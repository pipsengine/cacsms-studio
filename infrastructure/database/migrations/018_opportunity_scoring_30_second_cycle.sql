SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'018')
  BEGIN
    UPDATE cacsms.OpportunityScoringAutonomySettings
    SET RunIntervalSeconds=30,
        Enabled=1,
        NextRunAt=SYSUTCDATETIME(),
        UpdatedAt=SYSUTCDATETIME();

    INSERT dbo.SchemaMigrations(Version,Name,Checksum)
    VALUES(N'018',N'Opportunity scoring 30-second cycle',HASHBYTES('SHA2_256',N'018:Opportunity scoring 30-second cycle:v1'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
