SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version = N'004')
  BEGIN
    REVOKE CONTROL ON SCHEMA::cacsms TO cacsms_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::cacsms TO cacsms_app;
    GRANT EXECUTE ON SCHEMA::cacsms TO cacsms_app;
    DENY ALTER ON SCHEMA::cacsms TO cacsms_app;

    INSERT dbo.SchemaMigrations (Version, Name, Checksum)
    VALUES (N'004', N'Repair application schema permissions', HASHBYTES('SHA2_256', N'004:Repair application schema permissions'));
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
