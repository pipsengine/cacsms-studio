SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version = N'010')
  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.OpportunityOperationalRecords TO [$(ApplicationUser)];
    GRANT SELECT, INSERT, UPDATE, DELETE ON cacsms.OpportunityOperationalSettings TO [$(ApplicationUser)];
    INSERT dbo.SchemaMigrations (Version, Name, Checksum)
    VALUES (N'010', N'Opportunity operational permissions', HASHBYTES('SHA2_256', N'010:Opportunity operational permissions'));
  END;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
