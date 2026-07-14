SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version = N'003')
  BEGIN
    IF DATABASE_PRINCIPAL_ID(N'cacsms_app') IS NULL
      CREATE ROLE cacsms_app AUTHORIZATION dbo;

    IF DATABASE_PRINCIPAL_ID(N'$(ApplicationUser)') IS NULL
      THROW 50003, 'The configured application database user does not exist.', 1;

    GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::cacsms TO cacsms_app;
    GRANT EXECUTE ON SCHEMA::cacsms TO cacsms_app;
    REVOKE CONTROL ON SCHEMA::cacsms TO cacsms_app;
    DENY ALTER ON SCHEMA::cacsms TO cacsms_app;

    IF ISNULL(IS_ROLEMEMBER(N'cacsms_app', N'$(ApplicationUser)'), 0) <> 1
      ALTER ROLE cacsms_app ADD MEMBER [$(ApplicationUser)];

    INSERT dbo.SchemaMigrations (Version, Name, Checksum)
    VALUES (N'003', N'Repair application role membership', HASHBYTES('SHA2_256', N'003:Repair application role membership'));
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
